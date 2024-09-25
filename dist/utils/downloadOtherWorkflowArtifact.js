"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _exec = require('@actions/exec');

var _io = require('@actions/io'); var io = _interopRequireWildcard(_io);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);

/**
 * Use GitHub API to fetch artifact download url, then
 * download and extract artifact to `downloadPath`
 */
 async function downloadOtherWorkflowArtifact(
  octokit,
  {
    owner,
    repo,
    artifactId,
    artifactName,
    downloadPath,
  }






) {
  const artifact = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: "zip",
  });

  // Make sure output path exists
  try {
    await io.mkdirP(downloadPath);
  } catch (e) {
    // ignore errors
  }

  const downloadFile = _path2.default.resolve(downloadPath, `${artifactName}.zip`);

  await _exec.exec.call(void 0, "wget", [
    "-nv",
    "--retry-connrefused",
    "--waitretry=1",
    "--read-timeout=20",
    "--timeout=15",
    "-t",
    "0",
    "-O",
    downloadFile,
    artifact.url,
  ]);

  await _exec.exec.call(void 0, "unzip", ["-q", "-d", downloadPath, downloadFile], {
    silent: true,
  });
} exports.downloadOtherWorkflowArtifact = downloadOtherWorkflowArtifact;
