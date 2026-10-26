"""Touch-sized browser smoke test for the read-only fixed HMA table preview."""
from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parents[1]
rom=bytearray([0xff]*0x4000)
rom[0xA0:0xAC]=b'POKEMON TEST'
rom[0xAC:0xB0]=b'BPEE'
rom[0xB2]=0x96
rom[0x20:0x26]=bytes([5,0x34,0x12,8,0x78,0x56])
rom[0xBD]=(0x19-sum(rom[0xA0:0xBD]))&255
metadata="""[[NamedAnchors]]
Name = '''data.test.table'''
Address = 0x000020
Format = '''[hp. experience:]2'''
"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content((p/'app/CUBHMA_Mobile_Lab_Offline.html').read_text(),wait_until='load')
    page.locator('.mobile-tab[data-tab=anchors]').click()
    page.locator('#rom-picker').set_input_files({'name':'test.gba','mimeType':'application/octet-stream','buffer':bytes(rom)})
    page.locator('#metadata-picker').set_input_files({'name':'custom.toml','mimeType':'text/plain','buffer':metadata.encode()})
    page.locator('.anchor-entry').filter(has_text='data.test.table').click()
    assert page.locator('.semantic-table tbody tr').count()==2
    assert '4660' in page.locator('.semantic-table tbody tr').first.inner_text()
    assert '22136' in page.locator('.semantic-table tbody tr').nth(1).inner_text()
    page.locator('.semantic-row-jump').nth(1).click()
    assert '#/hex' in page.url
    assert page.locator('#selected-offset').input_value()=='000023'
    page.go_back()
    assert '#/anchors' in page.url
    assert not errors, errors
    browser.close()
print('BROWSER TABLE TEST PASSED: touch view, 2 fixed rows, jump to hex, Back, no JS errors')
