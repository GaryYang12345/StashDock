!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog '"$INSTDIR\stashdock-browser.exe" --register desktop'
  Pop $0
  StrCmp $0 0 +2
    MessageBox MB_OK|MB_ICONEXCLAMATION "Browser saving could not be configured. Open StashDock to retry."
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog '"$INSTDIR\stashdock-browser.exe" --unregister desktop'
  Pop $0
!macroend
