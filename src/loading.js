export const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export async function loadingStage(text, value) {
  document.getElementById('load-text').textContent = text;
  document.getElementById('progress').value = value;
  await yieldToBrowser();
}
