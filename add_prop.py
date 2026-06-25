import glob

files = glob.glob('src/app/(dashboard)/dashboard/cli-tools/components/*ToolCard.js')
for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'allowedModelsFilter={allowedModelsFilter}' in content:
        continue
        
    # We will look for 'title=' inside <ModelSelectModal and add the prop after the title string
    # e.g. title="..." -> title="..." allowedModelsFilter={allowedModelsFilter}
    
    import re
    # Match title="..." or title={...} inside ModelSelectModal tags
    pattern = r'(<ModelSelectModal\b[^>]*?title=["\'][^"\']*["\'])'
    
    def replacer(match):
        return match.group(1) + ' allowedModelsFilter={allowedModelsFilter}'

    new_content = re.sub(pattern, replacer, content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {file_path}')

print('Done.')
