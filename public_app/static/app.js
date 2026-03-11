const form = document.getElementById("report-form");
const input = document.getElementById("douban-id");
const statusPanel = document.getElementById("status-panel");
const statusTitle = document.getElementById("status-title");
const statusBadge = document.getElementById("status-badge");
const statusMessage = document.getElementById("status-message");
const statusError = document.getElementById("status-error");
const progressBar = document.getElementById("progress-bar");
const reportLink = document.getElementById("report-link");

let currentJobId = null;
let pollTimer = null;

function setStatus(state) {
  statusPanel.classList.remove("hidden");
  statusTitle.textContent = state.title || "Working...";
  statusBadge.textContent = state.badge || state.status || "Queued";
  statusMessage.textContent = state.message || "";
  progressBar.style.width = `${Math.max(0, Math.min(100, state.progress || 0))}%`;

  if (state.error) {
    statusError.textContent = state.error;
    statusError.classList.remove("hidden");
  } else {
    statusError.classList.add("hidden");
    statusError.textContent = "";
  }

  if (state.reportUrl) {
    reportLink.href = state.reportUrl;
    reportLink.classList.remove("hidden");
  } else {
    reportLink.classList.add("hidden");
    reportLink.removeAttribute("href");
  }
}

async function pollJob(jobId) {
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error("Failed to read job status.");
  }

  const job = await response.json();
  setStatus({
    title: `Building report for ${job.douban_id}`,
    badge: job.status,
    message: job.message,
    progress: job.progress,
    error: job.error,
    reportUrl: job.report_url,
  });

  if (job.status === "ready" && job.report_url) {
    window.location.href = job.report_url;
    return;
  }

  if (job.status === "failed") {
    return;
  }

  pollTimer = window.setTimeout(() => pollJob(jobId).catch(handleError), 2000);
}

function handleError(error) {
  setStatus({
    title: "Something went wrong",
    badge: "error",
    message: "",
    progress: 100,
    error: error.message || "Unknown error",
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const doubanId = input.value.trim();
  if (!doubanId) {
    handleError(new Error("Please enter a Douban ID or URL."));
    return;
  }

  if (pollTimer) {
    window.clearTimeout(pollTimer);
  }

  setStatus({
    title: "Submitting your request",
    badge: "queued",
    message: "Checking whether a saved report already exists.",
    progress: 5,
  });

  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ douban_id: doubanId }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "Request failed.");
    }

    if (payload.status === "ready" && payload.report_url) {
      window.location.href = payload.report_url;
      return;
    }

    currentJobId = payload.job_id;
    setStatus({
      title: `Building report for ${payload.douban_id}`,
      badge: payload.status,
      message: payload.message,
      progress: payload.progress,
    });
    pollJob(currentJobId).catch(handleError);
  } catch (error) {
    handleError(error);
  }
});
