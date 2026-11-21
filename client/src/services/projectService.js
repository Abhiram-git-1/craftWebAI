import api from "./api.js";

export async function fetchProjects() {
  const { data } = await api.get("/projects");
  return data.projects;
}

export async function createProject(payload) {
  const { data } = await api.post("/projects", payload);
  return data.project;
}

export async function renameProject(projectId, payload) {
  const { data } = await api.patch(`/projects/${projectId}`, payload);
  return data.project;
}

export async function removeProject(projectId) {
  const { data } = await api.delete(`/projects/${projectId}`);
  return data;
}

export async function saveGeneratedFile(projectId, path, content) {
  const { data } = await api.patch(`/projects/${projectId}/files`, {
    path,
    content,
  });

  return data.file;
}
