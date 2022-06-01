rm -rf dist
npm install
npm run build
git tag -d v1
git commit -am "new release"
git push origin :refs/tags/v1
git push origin refs/heads/v1
gh release create v1 --target refs/heads/v1 -t v1 -n ""