import requests
import json
import re
from random import choice

makes = {}
with open("src/iaaiMakes.json") as f:
    makes = json.load(f)

make_models = {}
try:
    for make, id in makes.items():
        if make < "johndeere":
            continue
        search_url = "https://iaai.com/AdvancedSearch/GetVehicleModels"
        form_data = { "SelectedMakes": id,
                    "IsSelectedRunAndDrive": False }
        print(f"fetching for {make}, id: {id}")
        headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0",
                    "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/x-www-form-urlencoded" }
        response = requests.request("POST",
                                    search_url,
                                    headers=headers,
                                    data=form_data)
        jsn = response.json()
        print(f"recieved {len(jsn)} models")
        if not len(jsn):
            continue
        make_models[make] = {
            "id": id,
            "models": {
                re.sub(r"\W", "", jsn_model['AC_Model_Name']).lower(): {
                    "displayName": jsn_model['AC_Model_Name'].strip(),
                    "id":          jsn_model['Salvage_Model_ID']
                }
                for jsn_model in jsn
            }
        }
        print(f"Sample model: {choice( list(make_models[make]['models']) )}\n")
except Exception as e:
    print(f"Uh-oh! Something went wrong.")
    print(e)
finally:
    print(f"Writing out {len(make_models)} records.")
    with open("src/iaaiMakeModels.json", "a") as f:
        json.dump(make_models, f, indent=4)

