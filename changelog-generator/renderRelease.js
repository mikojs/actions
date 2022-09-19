const core = require('@actions/core');
const { format } = require('date-fns');

const { getTagDate } = require('./getInfo');
const releaseInfo = require('./releaseInfo');

const renderItem = ({ number, url, title, user }) => [
  '-',
  `[#${number}](${url})`,
  title.replace(/[ ]+$/, ''),
  `([@${user.login}](${user.html_url}))`,
].join(' ');

const renderItemsWithWorkspaces = items => {
  const itemsWithWorkspaces = items.reduce(
    (result, item) => {
      const key = item.workspaces.includes('Other')
        ? 'Other'
        : item.workspaces
            .map(workspace => `\`${workspace}\``)
            .join(', ');

      return {
        ...result,
        [key]: [
          ...(result[key] || []),
          item,
        ],
      };
    },
    {},
  );

  if (Object.keys(itemsWithWorkspaces).length === 1)
    return itemsWithWorkspaces.Other.map(renderItem);

  return Object.keys(itemsWithWorkspaces)
    .map(key => [
      `- ${key}`,
      ...itemsWithWorkspaces[key]
        .map(item => `  ${renderItem(item)}`),
    ])
    .flat();
};

const renderLabel = ({ title, items }) =>
  items.length === 0
    ? []
    : [
        '',
        `#### ${title}`,
        ...renderItemsWithWorkspaces(items),
      ];

module.exports = async tag => {
  const nextVersion = tag === 'HEAD'
    ? core.getInput('next version')
    : tag;
  const date = tag === 'HEAD'
    ? new Date()
    : await getTagDate(tag);
  const release = [
    `## ${nextVersion} (${format(date, 'yyyy-MM-dd')})`,
    Object.values(releaseInfo.labels)
      .map(renderLabel)
      .flat(),
  ].flat()
    .join('\n');

  releaseInfo.reset();
  core.info(release);

  return release;
};
