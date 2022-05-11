# Issue Labeler

A Github Action that will find any linked issues in a pull requests main commit or comments, and set the given label on them when the pull is merged to the given branch

## Usage

Create a file named `.github/workflows/issue-labeler.yaml` (or any name in that directory) with the following content:

```yaml
name: Issue Labeler
on:
  push:
    branches:
      - main
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - uses: Passiolife/gh-issue-labeler@v1.1
        with:
          label: "in-dev"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
