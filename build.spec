# -*- mode: python ; coding: utf-8 -*-
a = Analysis(
    ['gls_sync/__main__.py'],
    pathex=['.'],
    hiddenimports=['pystray._win32'],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name='gls-sync',
    console=False,
    onefile=True,
)
