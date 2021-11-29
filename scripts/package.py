"""
Packages all the files in /src, swapping in /manifest-chrome.json and
/manifest-firefox.json
"""

import os
import re
from zipfile import ZipFile

SRC_PATH = "src"
DST_PATH = "releases"
MANIFEST_NAME_FX = "manifest-firefox.json"
MANIFEST_NAME_CR = "manifest-chrome.json"
ZIP_TEMPLATE_FX = "salvage_search-{0}-fx.zip"
ZIP_TEMPLATE_CR = "salvage_search-{0}-chrome.zip"

def zip_folder(zf, path_list, follow_symlinks=False):
    path = '/'.join(path_list)+'/'
    print( path )
    
    for filename in os.listdir(path):
        add_file_to_zip(zf, filename, path_list, follow_symlinks)

def add_file_to_zip(zf, filename, path_list, follow_symlinks=False):
    path = '/'.join(path_list)+'/'
    
    if os.path.isdir(path+filename):
        new_folder = path_list.copy()
        new_folder.append(filename)
        zip_folder(zf, new_folder, follow_symlinks)
        return

    print( f"{'.'*len(path)}{filename}", end='' )
    if filename == "manifest.json":
        print(" SKIPPED")
        return
    else:
        print()
    
    
    arcname = '/'.join(path_list[1:])+'/'+filename
    zf.write(filename=path+filename, arcname=arcname)



''' FIND VERSION NUMBER '''
with open(MANIFEST_NAME_FX, "r") as f:
    while True:
        line = f.readline()
        match = re.match(r' *\"version\": \"(.*)\"', line)
        if match:
            VERSION_NUM = match[1]
            break

''' MAKE FIREFOX ZIP '''
print(f'\n\nBuilding Firefox package for v${VERSION_NUM}')
zip_path_fx = DST_PATH+'/'+ZIP_TEMPLATE_FX.format(VERSION_NUM)
with ZipFile(zip_path_fx, "w") as zf:
    zip_folder(zf, [SRC_PATH])
    zf.write(MANIFEST_NAME_FX, "manifest.json")

''' MAKE CHROME ZIP '''
print(f'\n\nBuilding Chrome package for v${VERSION_NUM}')
zip_path_cr = DST_PATH+'/'+ZIP_TEMPLATE_CR.format(VERSION_NUM)
with ZipFile(zip_path_cr, "w") as zf:
    zip_folder(zf, [SRC_PATH])
    zf.write(MANIFEST_NAME_CR, "manifest.json")
