"use strict"; function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _fs = require('fs');

var _core = require('@actions/core'); var core = _interopRequireWildcard(_core);
var _github = require('@actions/github');

var _markdowntable = require('markdown-table');

var _SizeLimit = require('size-limit-action/src/SizeLimit'); var _SizeLimit2 = _interopRequireDefault(_SizeLimit);
var _githubfetchworkflowartifact = require('github-fetch-workflow-artifact'); var _githubfetchworkflowartifact2 = _interopRequireDefault(_githubfetchworkflowartifact);

const SIZE_LIMIT_HEADING = `## Bundle size 📦 `;
const ARTIFACT_NAME = "size-limit-action";
const RESULTS_FILE = "size-limit-results.json";

async function run() {
  const { getInput, setFailed } = core;

  try {
    const { repo } = _github.context;

    const version = getInput("version");
    const githubToken = getInput("github_token");
    const workflowName = getInput("workflow_name");
    const branchName = getInput("branch_name") || `release/${version}`;

    const octokit = _github.getOctokit.call(void 0, githubToken);

    const limit = new (0, _SizeLimit2.default)();
    const resultsFilePath = _path2.default.resolve(__dirname, RESULTS_FILE);

    const release = await octokit.rest.repos.getReleaseByTag({
      ...repo,
      tag: version,
    });

    if (_optionalChain([release, 'access', _ => _.data, 'access', _2 => _2.body, 'optionalAccess', _3 => _3.includes, 'call', _4 => _4(SIZE_LIMIT_HEADING)])) {
      core.debug("Size info already exists, skipping...");
      return;
    }

    await _githubfetchworkflowartifact2.default.call(void 0, octokit, {
      ...repo,
      artifactName: ARTIFACT_NAME,
      branch: branchName,
      downloadPath: __dirname,
      workflowEvent: "push",
      workflowName,
    });

    const sizeLimitResults = JSON.parse(
      await _fs.promises.readFile(resultsFilePath, { encoding: "utf8" })
    );

    const body = [
      release.data.body,
      SIZE_LIMIT_HEADING,
      // Note: The size limit result table will add (added) to each result, because we do not compare against anything
      // We just remove these entries, as we don't care about them.
      _markdowntable.markdownTable.call(void 0, limit.formatResults(undefined, sizeLimitResults)).replace(/ (added)/gmi, ''),
    ].join("\r\n\r\n");

    await octokit.rest.repos.updateRelease({
      ...repo,
      release_id: release.data.id,
      body,
    });
  } catch (error) {
    core.debug(error);
    setFailed(error.message);
  }
}

run();
