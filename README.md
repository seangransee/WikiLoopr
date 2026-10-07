The first link in a Wikipedia article will take you to a broader subject. Repeat this over and over, and you’ll almost always end up in the same loop. Don’t believe me? Try it yourself.

[Try WikiLoopr](https://wikiloopr.seangransee.com/)

Contact: Sean Gransee <sean.gransee@gmail.com>

### Run locally

Node.js 22 or newer is the only runtime required. Wikipedia content is fetched
directly from its public API over HTTPS, with CORS enabled; no backend or API key
is needed.

```
git clone https://github.com/seangransee/WikiLoopr.git
cd WikiLoopr
npm ci
npm start
```
Then navigate to [http://127.0.0.1:4173](http://127.0.0.1:4173).

`npm test` checks first-link extraction, redirects, loop counts, dead ends,
cancellation, and the chain limit. `npm run build` produces a standalone `dist/`
folder. The build includes the existing translations and starting articles.

### GitHub Pages

The `Build and deploy WikiLoopr` GitHub Actions workflow tests and builds pull
requests, then deploys pushes to `master`. In Settings → Pages, choose **GitHub
Actions** as the publishing source. The output works both at a repository path
(`https://seangransee.github.io/WikiLoopr/`) and at the custom domain root.

The custom domain is `wikiloopr.seangransee.com`. Its DNS CNAME must point to
`seangransee.github.io`, and the same domain must be set in Settings → Pages.
Enable Enforce HTTPS after GitHub provisions the certificate. The repository's
`CNAME` file is included in the build to document the domain.

Share an article using `?lang=en&article=Apple`; query-string routing allows
direct visits and reloads on static hosting. Supported Wikipedia editions are
English, Spanish, French, German, Russian, and Dutch.
You can also paste a Wikipedia article URL into the starting-article field;
WikiLoopr selects its language and extracts the article title automatically.

The first eligible link is taken from article paragraphs, excluding parentheses,
italics, bold definitions, sidebars, citations, and non-article links. Lists are
used as a fallback. Chains stop on a repeated canonical article title, a dead
end, a request error, the Stop button, or the 200-article limit.
