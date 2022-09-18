const core = require('@actions/core');
const github = require('@actions/github');

const { repo } = github.context;
const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

const getPullRequestNumbers = async basehead => {
  const { data: { commits } } = await octokit.request(
    'GET /repos/{owner}/{repo}/compare/{basehead}', {
      ...repo,
      basehead,
    },
  );

  return commits.reduce((result, { commit: { message }}) => {
    const pullRequestNumber = message
      .replace(/\*.+/g, '')
      .match(/\(#\d+\)/)
      ?.[0]
      .replace(/\(#(.+)\)/, (_, p1) => p1);

    return !pullRequestNumber
      ? result
      : [...result, pullRequestNumber];
  }, []);
};

const getPullRequests = async () => {
  const { data: pullRequests } = await octokit.rest.pulls.list({
    ...repo,
    state: 'all',
  });

  pullRequests.forEach(({ title, body, state }) => {
    // console.log(title, body, state);
  });
}

(async () => {
  try {
    // TODO: should remove basehead
    console.log(await getPullRequestNumbers('v1.0.0...HEAD'));
  } catch (e) {
    core.setFailed(e.message);
  }
})();
