name: Auto-merge to main

on:
  push:
    branches:
      - 'claude/**'

permissions:
  contents: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Merge branch to main
        run: |
          git checkout main
          git merge --no-ff origin/${{ github.ref_name }} -m "Auto-merge ${{ github.ref_name }} → main"
          git push origin main
