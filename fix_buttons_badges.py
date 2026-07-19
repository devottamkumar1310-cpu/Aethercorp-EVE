import os
import re

def fix_buttons_and_badges(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if not file.endswith('.tsx'):
                continue
                
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            original_content = content
            
            # 1. Primary Buttons: bg-indigo-600 with text-foreground -> !text-white
            # We match bg-indigo-600 or hover:bg-indigo-700 and text-foreground
            content = re.sub(
                r'(bg-indigo-600[^"]*?)\btext-foreground\b',
                r'\1!text-white',
                content
            )
            
            # 2. Status & Priority Badges
            # "Light pink badge -> dark red text" -> bg-red-100
            # Replace text-red-xxx or no text color with !text-red-900
            content = re.sub(
                r'(bg-red-100\b[^"\'`}]*?)\btext-red-[0-9]+\b',
                r'\1!text-red-900',
                content
            )
            content = re.sub(
                r'(bg-pink-100\b[^"\'`}]*?)\btext-pink-[0-9]+\b',
                r'\1!text-rose-900',
                content
            )
            # "Light yellow badge -> dark amber/brown text" -> bg-yellow-100
            content = re.sub(
                r'(bg-yellow-100\b[^"\'`}]*?)\btext-(yellow|amber)-[0-9]+\b',
                r'\1!text-amber-900',
                content
            )
            # "Dark blue/red/green badges -> white text"
            content = re.sub(
                r'(bg-(blue|indigo|red|green|emerald|destructive)-[56789]00\b[^"\'`}]*?)\btext-(blue|indigo|red|green|emerald|destructive)-[12345]00\b',
                r'\1!text-white',
                content
            )
            # if they have no text color, let's just make sure we don't break logic.
            # I will just replace text-white with !text-white on dark backgrounds
            content = re.sub(
                r'(bg-(blue|indigo|red|green|emerald|destructive|slate)-[56789]00\b[^"\'`}]*?)\btext-white\b',
                r'\1!text-white',
                content
            )
            
            if content != original_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {path}")

if __name__ == '__main__':
    fix_buttons_and_badges(r'c:\Users\Devottam\OneDrive\Pictures\Desktop\Project\aethercorp-eve\frontend\src')
