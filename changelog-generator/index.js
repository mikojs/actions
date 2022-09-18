const core = require('@actions/core');
const github = require('@actions/github');

(async () => {
  try {
    const { repo } = github.context;
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    const { data: pullRequests } = await octokit.rest.pulls.list({
      ...repo,
      state: 'all',
    });

    console.log(pullRequests);
  } catch (e) {
    core.setFailed(e.message);
  }
})();
