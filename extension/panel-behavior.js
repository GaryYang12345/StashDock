// Chrome persists panel behavior across extension updates. The old library
// sidebar opened automatically and bypassed action.onClicked; the save-only
// sidebar must receive that gesture to authorize and capture its current tab.
export async function synchronizeActionBehavior(chromeApi) {
  if (chromeApi.sidePanel?.setPanelBehavior) await chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}
