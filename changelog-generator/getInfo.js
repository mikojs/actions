const { repo, octokit } = require('./utils');

exports.getFrom = async from => {
  if (from !== 'latest tag')
    return from;

  const {
    data: [{ name } = {}],
  } = await octokit.rest.repos.listTags(repo);

  if (!name)
    throw new Error('Here should have at least one tag');

  return name;
};

exports.getPullRequestNumbers = async basehead => {
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

exports.getTagDate = async tag => {
  const {
    repository: {
      ref: { target },
    },
  } = await octokit.graphql(`
    query getTagDate($owner: String!, $repo: String!, $qualifiedName: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $qualifiedName) {
          id
          target {
            typename: __typename
            ... on Tag {
              id
              tagger {
                date
              }
            }
            ... on Commit {
              id
              committer {
                date
              }
            }
          }
        }
      }
    }
  `, {
    ...repo,
    qualifiedName: `refs/tags/${tag}`,
  });

  return new Date(
    target.typename === 'Tag'
      ? target.tagger.date
      : target.committer.date,
  );
};
