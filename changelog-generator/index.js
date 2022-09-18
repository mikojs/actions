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

const getPullRequests = pullRequestNumbers =>
  Promise.all(pullRequestNumbers.map(
    async pullRequestNumber => {
      const { data: { title, body } } = await octokit.rest.pulls.get({
        ...repo,
        pull_number: pullRequestNumber,
      });

      return { title, body };
    },
  ));

(async () => {
  try {
    // TODO: should remove basehead
    const pullRequestNumbers = await getPullRequestNumbers('v1.0.0...HEAD');
    const pullRequests = await getPullRequests(pullRequestNumbers);

    console.log(pullRequests)
  } catch (e) {
    core.setFailed(e.message);
  }
})();
