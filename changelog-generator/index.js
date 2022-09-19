const core = require('@actions/core');

const { getFrom, getPullRequestNumbers } = require('./getInfo');
const loadInfo = require('./loadInfo');
const renderRelease = require('./renderRelease');

(async () => {
  try {
    const releases = await core.getMultilineInput('tags')
      .reduce(async (resultP, tag, index, tags) => {
        const result = await resultP;

        if (index === 0)
          return result;

        const from = await getFrom(tags[index - 1]);

        core.debug(`generating a release from ${from} to ${tag}`);
        await loadInfo(
          await getPullRequestNumbers(`${from}...${tag}`),
        );

        return [
          ...result,
          '',
          await renderRelease(tag),
        ];
      }, Promise.resolve([]));

    core.setOutput('output', releases.reverse().join('\n'));
  } catch (e) {
    core.setFailed(e.message);
  }
})();
