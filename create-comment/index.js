const core = require('@actions/core');
const github = require('@actions/github');

const token = core.getInput('token', { required: true });
const comment = core.getInput('comment', { required: true });
const issue = core.getInput('issue', { required: true });
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const octokit = github.getOctokit(token);

(async () => {
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issue,
  });

  if (!comments.data) {
    core.setFailed(`Couldn't get the comments list.`);
    return;
  }

  const botCommentExist = comments.data.some(
    ({ user }) => user.login === 'github-actions[bot]',
  );

  if (botCommentExist) return;

  octokit.rest.issues
    .createComment({
      owner,
      repo,
      issue_number: issue,
      body: comment,
    })
    .then(
      ({ status }) => {
        if (status < 200 || status >= 300)
          core.setFailed(`Received status ${status} from API.`);
      },
      e => core.setFailed(e.message),
    );
})();
