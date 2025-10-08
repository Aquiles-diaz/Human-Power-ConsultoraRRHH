import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 375, 'height': 667},
        is_mobile=True,
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1'
    )
    page = context.new_page()

    try:
        page.goto("http://localhost:5173/")

        # Open the mobile navigation menu
        page.get_by_role("button", name="Abrir menú").click()

        # Open the login/register dialog
        page.get_by_role("button", name="Entrar / Registrarse").click()

        # Switch to the registration form (the tab button)
        page.get_by_role("button", name="Crear cuenta").first.click()

        # Scope actions to the registration form
        register_form = page.locator("form")

        # Fill out the registration form
        register_form.get_by_placeholder("Tu nombre").fill("Test User")
        register_form.get_by_placeholder("tu@email.com").fill("test-user-2@example.com")
        register_form.get_by_placeholder("********").fill("password123")

        # Click the submit button inside the registration form
        register_form.get_by_role("button", name="Crear cuenta").click()

        # Wait for the login form to be visible after registration
        expect(page.get_by_role("button", name="Iniciar sesión")).to_be_visible()

        # Scope actions to the login form
        login_form = page.locator("form")

        # Log in with the new account
        login_form.get_by_placeholder("tu@email.com").fill("test-user-2@example.com")
        login_form.get_by_placeholder("********").fill("password123")
        login_form.get_by_role("button", name="Ingresar").click()

        # The welcome banner should appear
        banner = page.get_by_role("status")
        expect(banner).to_be_visible()
        expect(banner).to_contain_text("¡Bienvenido/a, Test!")

        # And then it should disappear automatically
        expect(banner).to_have_count(0, timeout=3000)

        # Take a screenshot to show the banner is gone
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        context.close()
        browser.close()

with sync_playwright() as playwright:
    run(playwright)