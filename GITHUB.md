# GitHub Pages deployment

Stiftspur is a static application. GitHub Pages can serve `dist/` directly. All app assets use relative paths, including when the app is hosted at `/stiftspur/`. No backend, API keys or additional npm packages are required.

## Repository

The target repository is [knecht-d/stiftspur](https://github.com/knecht-d/stiftspur). Its initial publication is intended to contain the current project snapshot in a single **Initial commit**, without the earlier development history.

## Enable GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Publish Stiftspur** and run the workflow on `main` if the initial push ran before Pages was enabled.
4. Check the deployment result and open the URL shown by the workflow.

The expected project URL is <https://knecht-d.github.io/stiftspur/>. It becomes available only after a successful deployment.

The workflow at `.github/workflows/pages.yml` runs the geometry, variant and export tests, regenerates font previews, and publishes only `dist/`. It runs on pushes to `main` and can also be started manually. Font assets are already checked in; Python/fontTools is only needed when rebuilding them from source.

GitHub Pages publishes the site publicly. Text and uploaded fonts are still processed locally in each visitor's browser.

## Permissions

The deployment workflow requests `contents: read`, `pages: write` and `id-token: write`. These are the workflow's runtime permissions.

An external GitHub App that creates or changes `.github/workflows/` files also needs the separate **Workflows** repository permission in addition to **Contents** write access. Changing the runtime permissions in the YAML does not grant that external app permission to edit workflow files. Repository administrator access for the account does not prove that an installed integration has the same rights.

## References

- [Custom GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Configure a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Choose permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
