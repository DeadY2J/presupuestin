import { expect, test, type Page } from "@playwright/test";

/** Recoge errores de consola y de página (por ejemplo, un script bloqueado por la CSP). */
function vigilarErrores(page: Page) {
  const errores: string[] = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  page.on("pageerror", (e) => errores.push(e.message));
  return errores;
}

test.beforeEach(async ({ request }) => {
  await request.post("/api/demo/reiniciar");
});

test("la portada carga con CSP y sin errores", async ({ page }) => {
  const errores = vigilarErrores(page);
  const respuesta = await page.goto("/");
  expect(respuesta?.headers()["content-security-policy"]).toContain("nonce-");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dicta la obra");
  await expect(page.getByRole("heading", { name: "Presupuesto", exact: true })).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
  expect(errores).toEqual([]);
});

test("de la obra al sello «Aprobado»", async ({ page, context }) => {
  const errores = vigilarErrores(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Baño de la familia Gómez/ }).click();
  // La hoja se escribe en vivo mientras llega el audio.
  await expect(page.locator("#hoja tbody tr").filter({ hasText: "Colocación de azulejo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pasar a limpio el presupuesto" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Pasar a limpio el presupuesto" }).click();

  // La línea que no está en la lista queda sin precio y bloquea el envío.
  const enviar = page.getByRole("button", { name: "Enviar por WhatsApp" });
  await expect(enviar).toBeDisabled();
  await page.getByRole("spinbutton", { name: /Precio de Revisar humedad/ }).fill("450");
  await enviar.click();
  const enlace = page.getByRole("link", { name: /Abrir como el cliente/ });
  await expect(enlace).toBeVisible();

  // El cliente firma desde su enlace.
  const cliente = await context.newPage();
  const erroresCliente = vigilarErrores(cliente);
  await cliente.goto((await enlace.getAttribute("href"))!);
  await cliente.getByLabel("Tu nombre completo").fill("Laura Gómez");
  await cliente.getByRole("checkbox").check();
  await cliente.getByRole("button", { name: "Firmar y aceptar" }).click();
  await expect(cliente.getByRole("status")).toContainText("Aceptaste el presupuesto");

  // El panel se actualiza solo y queda aprobado.
  await expect(page.getByText("Aprobado por Laura Gómez")).toBeVisible({ timeout: 10_000 });
  expect([...errores, ...erroresCliente]).toEqual([]);
});

test("un enlace de cliente sin token válido no muestra nada", async ({ page }) => {
  await page.goto("/firma/no-existe?t=falso");
  await expect(page.getByText(/Este enlace no es válido/)).toBeVisible();
});
