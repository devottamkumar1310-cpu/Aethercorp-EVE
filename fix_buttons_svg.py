import os
import re

def fix_double_bangs_and_svgs(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if not file.endswith('.tsx'):
                continue
                
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            original_content = content
            
            # Fix !!text-white and add svg overrides
            content = re.sub(
                r'!!text-white',
                r'!text-white [&_svg]:!text-white [&_svg]:!stroke-white',
                content
            )
            
            if content != original_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {path}")

if __name__ == '__main__':
    fix_double_bangs_and_svgs(r'c:\Users\Devottam\OneDrive\Pictures\Desktop\Project\aethercorp-eve\frontend\src')
