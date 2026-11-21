import api from "./api.js";

export async function requestWebsitePlan(projectId, prompt) {
  const { data } = await api.post(`/projects/${projectId}/generation/plan`, {
    prompt,
  });
  return data.plan;
}

export async function generateWebsite(projectId) {
  const { data } = await api.post(`/projects/${projectId}/generation/generate`);
  return data;
}

export async function fetchGeneration(projectId) {
  const { data } = await api.get(`/projects/${projectId}/generation`);
  return data.generation;
}
