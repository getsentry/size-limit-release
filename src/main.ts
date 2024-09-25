import path from "path";
import { promises as fs } from "fs";

import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { markdownTable } from "markdown-table";
import SizeLimit from "size-limit-action/src/SizeLimit";

import { getArtifactsForBranchAndWorkflow } from "./utils/getArtifactsForBranchAndWorkflow";
import { downloadOtherWorkflowArtifact } from "./utils/downloadOtherWorkflowArtifact";

const SIZE_LIMIT_HEADING = `## Bundle size 📦 `;
const ARTIFACT_NAME = "size-limit-action";
const RESULTS_FILE = "size-limit-results.json";

async function run() {
  const { getInput, setFailed } = core;

  core.info('GET ME THE STUFF!')

  try {
    const { repo } = context;

    const version = getInput("version");
    const githubToken = getInput("github_token");
    const workflowName = getInput("workflow_name");
    const branchName = getInput("branch_name") || `release/${version}`;

    const octokit = getOctokit(githubToken);

    const limit = new SizeLimit();
    const resultsFilePath = path.resolve(__dirname, RESULTS_FILE);

    const release = await octokit.rest.repos.getReleaseByTag({
      ...repo,
      tag: version,
    });

    if (release.data.body?.includes(SIZE_LIMIT_HEADING)) {
      core.debug("Size info already exists, skipping...");
      return;
    }

    core.debug(`Fetching artifacts for branch=${branchName} and workflow=${workflowName}`);

    const artifacts = await getArtifactsForBranchAndWorkflow(octokit, {
      ...repo,
      artifactName: ARTIFACT_NAME,
      branch: branchName,
      workflowName,
    });

    await downloadOtherWorkflowArtifact(octokit, {
      ...repo,
      artifactName: ARTIFACT_NAME,
      artifactId: artifacts.artifact.id,
      downloadPath: __dirname,
    });

    const sizeLimitResults = JSON.parse(
      await fs.readFile(resultsFilePath, { encoding: "utf8" })
    );

    const body = [
      release.data.body,
      SIZE_LIMIT_HEADING,
      // Note: The size limit result table will add (added) to each result, because we do not compare against anything
      // We just remove these entries, as we don't care about them.
      markdownTable(limit.formatResults(undefined, sizeLimitResults)).replace(
        / \(added\)/gim,
        ""
      ),
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
