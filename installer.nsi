!define APP_NAME    "Divergency"
!define EXE_NAME    "Divergency.exe"
!define INSTALL_DIR "$PROGRAMFILES\${APP_NAME}"

Name "${APP_NAME}"
OutFile "dist\${APP_NAME}-Setup.exe"
InstallDir "${INSTALL_DIR}"

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  ; Copy the bundled directory's single .exe
  File /oname=$INSTDIR\${EXE_NAME} "dist\Divergency\${EXE_NAME}"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${EXE_NAME}"
SectionEnd
