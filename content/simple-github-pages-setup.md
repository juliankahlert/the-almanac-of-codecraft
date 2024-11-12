# Deploying Your Website with GitHub Pages and GitHub Actions

Publishing a static website on GitHub Pages with GitHub Actions streamlines deployment by automating the build and publish process.
With this simple setup, your site builds and deploys automatically whenever you update the source code, freeing you from the need to manually push updates.
GitHub Actions makes it easy to create and configure this workflow, providing a reliable way to keep your site live and current with minimal effort.

## Overview

The automation we’ll set up in this guide does three main things:
1. Builds the website files.
2. Uploads these files as an artifact, preparing them for deployment.
3. Publishes the files on GitHub Pages.

To achieve this, two specific GitHub Actions do the work:
- **`actions/upload-pages-artifact`** stores the files for deployment.
- **`actions/deploy-pages`** handles the actual publication to GitHub Pages.

## Creating the Workflow File

The first step is to set up a configuration file, called `ci.yml`, which GitHub Actions uses to know when and how to build and deploy your site.
The file is stored in a special folder in your repository, `.github/workflows`, which GitHub automatically scans for workflow files.

Create this file by making a `.github/workflows` directory in your repository, then place an empty `ci.yml` file inside:

```sh
mkdir -p .github/workflows
touch .github/workflows/ci.yml
```

Once the file is ready, open it in a text editor and add the configuration details.

## Editing the Workflow File

In `ci.yml`, the configuration starts with a trigger that tells GitHub to run the workflow on any push to any branch in the repository.
This automatic trigger ensures the workflow activates whenever you push a change, which allows you to update the website without manually initiating a deployment each time.
The following **YAML** configuration provides an example setup:

```yaml
name: Deploy Website to GitHub Pages

on:
  push:
    branches:
      - '**'

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Website
        run: |
          mkdir ./www
          cp src/index.html ./www/index.html

      - name: Setup GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: actions/configure-pages@v5

      - name: Upload Website Artifact
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-pages-artifact@v3
        with:
          path: "./www"

  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: build

    permissions:
      pages: write
      id-token: write

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

This configuration includes two jobs: **build** and **deploy**. 

The **build** job begins by pulling your code from the repository using `actions/checkout@v4` and prepares the files for deployment by creating a new `www` directory.
It assumes that your main website files are in a folder called `src`, so it copies `index.html` from `src` into the `www` folder.
If your website structure is different, adjust these paths to match your project. 

The **deploy** job only runs if the build job completes successfully.
It relies on the **upload-pages-artifact** action to store the website files and the **deploy-pages** action to publish them to GitHub Pages.
With permissions set to allow writing to GitHub Pages, this step uses the `deploy-pages` action to retrieve the artifact and deploy it.

## Publishing and Accessing the Website

Once you have the file edited to your liking, commit and push it to the repository:

```sh
git add .github/workflows/ci.yml
git commit -m "github: workflows: Add GH Pages deployment workflow"
git push
```

After GitHub completes the workflow, your site will be live on GitHub Pages at `https://<your-username>.github.io/<your-repository>`.
Replace `<your-username>` and `<your-repository>` with your GitHub username and repository name, respectively.

With this automated workflow, GitHub Pages now takes care of deploying your site whenever you push changes to the `main` branch.
This gives you an easy, automated way to keep your website up-to-date with just a simple push to GitHub.
