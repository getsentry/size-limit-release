"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } }var _core = require('@actions/core'); var core = _interopRequireWildcard(_core);


// max pages of workflows to pagination through
const DEFAULT_MAX_PAGES = 50;
// max results per page
const DEFAULT_PAGE_LIMIT = 10;

/**
 * Fetch artifacts from a workflow run from a branch
 *
 * This is a bit hacky since GitHub Actions currently does not directly
 * support downloading artifacts from other workflows
 */
/**
 * Fetch artifacts from a workflow run from a branch
 *
 * This is a bit hacky since GitHub Actions currently does not directly
 * support downloading artifacts from other workflows
 */
 async function getArtifactsForBranchAndWorkflow(
  octokit,
  {
    owner,
    repo,
    workflowName,
    branch,
    artifactName,
  }






) {
  let repositoryWorkflow = null;

  // For debugging
  const allWorkflows = [];

  //
  // Find workflow id from `workflowName`
  //
  for await (const response of octokit.paginate.iterator(
    octokit.rest.actions.listRepoWorkflows,
    {
      owner,
      repo,
    }
  )) {
    const data = response.data ;

    const targetWorkflow = data.find(({ name }) => name === workflowName);

    allWorkflows.push(...data.map(({ name }) => name));

    // If not found in responses, continue to search on next page
    if (!targetWorkflow) {
      continue;
    }

    repositoryWorkflow = targetWorkflow;
    break;
  }

  if (!repositoryWorkflow) {
    core.info(
      `Unable to find workflow with name "${workflowName}" in the repository. Found workflows: ${allWorkflows.join(
        ", "
      )}`
    );
    return null;
  }

  const workflow_id = repositoryWorkflow.id;

  let currentPage = 0;
  let latestWorkflowRun = null;

  core.info(`Fetching workflow runs for parameters: owner=${owner}, repo=${repo}, workflow_id=${workflow_id}, branch=${branch}`);

  for await (const response of octokit.paginate.iterator(
    octokit.rest.actions.listWorkflowRuns,
    {
      owner,
      repo,
      workflow_id,
      branch,
      per_page: DEFAULT_PAGE_LIMIT,
      event: "push",
    }
  )) {
    const data = response.data 




;
    if (!response.data.length) {
      core.warning(`Workflow ${workflow_id} not found in branch ${branch}`);
      return null;
    }

    // Do not allow downloading artifacts from a fork.
    const filtered = data.filter(
      (workflowRun) =>
        workflowRun.head_repository.full_name === `${owner}/${repo}`
    );

    // Sort to ensure the latest workflow run is the first
    filtered.sort((a, b) => {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // Store the first workflow run, to determine if this is the latest one...
    if (!latestWorkflowRun) {
      latestWorkflowRun = filtered[0];
    }

    // Search through workflow artifacts until we find a workflow run w/ artifact name that we are looking for
    for (const workflowRun of filtered) {
      core.info(`Checking artifacts for workflow run: ${workflowRun.html_url}`);

      const {
        data: { artifacts },
      } = await octokit.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: workflowRun.id,
      });

      core.info(`Found ${artifacts.length} artifacts for workflow run: ${artifacts.map(({ name }) => name).join(", ")}`);

      if (!artifacts) {
        core.warning(
          `Unable to fetch artifacts for branch: ${branch}, workflow: ${workflow_id}, workflowRunId: ${workflowRun.id}`
        );
      } else {
        const foundArtifact = artifacts.find(
          ({ name }) => name === artifactName
        );
        if (foundArtifact) {
          core.info(`Found suitable artifact: ${foundArtifact.url}`);
          return {
            artifact: foundArtifact,
            workflowRun,
            isLatest: latestWorkflowRun.id === workflowRun.id,
          };
        } else {
          core.info(
            `No artifact found for ${artifactName}, trying next workflow run...`
          );
        }
      }
    }

    if (currentPage > DEFAULT_MAX_PAGES) {
      core.warning(`Workflow ${workflow_id} not found in branch: ${branch}`);
      return null;
    }

    currentPage++;
  }

  core.warning(`Artifact not found: ${artifactName}`);
  core.endGroup();
  return null;
} exports.getArtifactsForBranchAndWorkflow = getArtifactsForBranchAndWorkflow;
