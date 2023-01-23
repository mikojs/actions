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

  const botComment = comments.data.find(
    ({ user }) => user.login === 'github-actions[bot]',
  );

  if (botComment) {
    if (comment !== botComment.body)
      await octokit.rest.issues
        .deleteComment({
          owner,
          repo,
          comment_id: botComment.id,
        });
  }

  if (comment === botComment.body) return;

  await octokit.rest.issues
    .createComment({
      owner,
      repo,
      issue_number: issue,
      body: comment,
    });
  core.setFailed('See the comments in the PR');
})();
