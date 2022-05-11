rm -rf dist
npm install
npm run build
git tag -d v1
git push origin :refs/tags/v1