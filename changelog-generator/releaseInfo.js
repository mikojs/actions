const core = require('@actions/core');

const releaseInfo = {
  labels: {},
};
const { workspaces = {}, labels = {} } = JSON.parse(
  core.getInput('config'),
);

releaseInfo.workspaces = workspaces;

Object.keys(labels)
  .forEach(key => {
    releaseInfo.labels[key] = {
      title: labels[key],
      items: [],
    };
  });

if (!releaseInfo.labels.uncategorized)
  releaseInfo.labels.uncategorized = {
    title: ':question: Uncategorized',
    items: [],
  };

releaseInfo.reset = () => {
  Object.keys(releaseInfo.labels)
    .forEach(key => {
      releaseInfo.labels[key].items = [];
    });
};

module.exports = releaseInfo;
