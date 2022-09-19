const core = require('@actions/core');

const { repo, octokit } = require('./utils');
const releaseInfo = require('./releaseInfo');

module.exports = pullRequestNumbers =>
  pullRequestNumbers.reduce(
    async (resultP, pullRequestNumber) => {
      await resultP;
      core.debug(`loading ${pullRequestNumber}`);

      const {
        data: { html_url: url, title, body, labels, user },
      } = await octokit.rest.pulls.get({
        ...repo,
        pull_number: pullRequestNumber,
      });
      const {
        data,
      } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
        ...repo,
        pull_number: pullRequestNumber,
      });
      const item = {
        number: pullRequestNumber,
        url,
        title,
        // TODO: body could overwrite title
        body,
        user,
        workspaces: data.reduce(
          (result, { filename }) => {
            const key = Object.entries(releaseInfo.workspaces)
              .find(([, worksapcesPath]) => filename.includes(worksapcesPath));

            return !key || result.includes(key)
              ? result
              : [...result, key];
          },
          [],
        ),
      };

      if (item.workspaces.length === 0)
        item.workspaces.push('notFound');

      core.debug(item);
      labels.forEach(({ name }) => {
        const { items } = (releaseInfo.labels[name] || releaseInfo.labels.uncategorized);

        if (items.some(({ number }) => number === item.number))
          return;

        items.unshift(item);
      });
      core.debug(`${pullRequestNumber} is added`);
    },
    Promise.resolve(),
  );
