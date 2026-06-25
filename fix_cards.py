import os
import re

files_to_update = [
    'src/app/(dashboard)/dashboard/cli-tools/components/OpenCodeToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/OpenClawToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/ClineToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/CopilotToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/CoworkToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/KiloToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/DroidToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/HermesToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/DeepSeekTuiToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/JcodeToolCard.js',
    'src/app/(dashboard)/dashboard/cli-tools/components/DefaultToolCard.js'
]

for file_path in files_to_update:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'isModelAllowed' in content:
            continue
            
        # 1. Add import
        match = re.search(r"(import \{ matchKnownEndpoint \} from ['\"]\./cliEndpointMatch['\"];)", content)
        if match:
            content = content.replace(match.group(1), match.group(1) + '\nimport { isModelAllowed } from "@/lib/modelMatcher";')
        
        # 2. Add allowedModelsFilter and useEffect
        # Find 'const handleApply'
        if 'const handleApply' in content and 'const selectedKeyObj = apiKeys?.find' not in content:
            target_func = 'const handleApply'
            snippet = f'''
  // Option A: Strict reset of models if disallowed by the selected API Key
  const selectedKeyObj = apiKeys?.find(k => k.key === selectedApiKey);
  const allowedModelsFilter = selectedKeyObj?.allowedModels || [];

  useEffect(() => {{
    if (allowedModelsFilter.length === 0) return;
    if (selectedModel && !isModelAllowed(allowedModelsFilter, selectedModel)) {{
      setSelectedModel("");
    }}
  }}, [allowedModelsFilter, selectedModel]);

  '''
            content = content.replace(target_func, snippet + target_func)
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {file_path}')
    except Exception as e:
        print(f'Error updating {file_path}: {e}')

print("Done.")
