; Fail closed instead of killing another version by executable name.
!macro customCheckAppRunning
  InitPluginsDir
  File /oname=$PLUGINSDIR\vivid-check-target.ps1 "${PROJECT_DIR}\..\tools\installer\check-install-target.ps1"
  nsExec::ExecToStack '"$PowerShellPath" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\vivid-check-target.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Please choose a separate client folder and close any client running from that folder. CF runtimes and user data must stay outside the client installation."
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend
