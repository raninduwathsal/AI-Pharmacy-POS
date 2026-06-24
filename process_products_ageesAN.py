import pandas as pd
import re

df = pd.read_excel('live_update_pricelist.xlsx')

# Convert to numeric, turning non-numeric into NaN
df['WSP'] = pd.to_numeric(df['WSP'], errors='coerce')
df['MRP'] = pd.to_numeric(df['MRP'], errors='coerce')

# Drop rows where WSP or MRP are NaN
df = df.dropna(subset=['WSP', 'MRP'])

# Create the final dataframe matching the app's import format
export_df = pd.DataFrame({
    'name': df['PRODUCT NAME'].astype(str),
    'measure_unit': 'Unit',
    'category': '',
    'reorder_threshold': 0,
    'current_stock': 0,
    'selling_price': df['MRP'],
    'unit_cost': df['WSP'],
    'location': '',
    'expiry_dates': ''
})

def process_pack_size(row):
    name = str(row['name'])
    match = re.search(r'(\d+)[\'\s]*s\s*$', name, re.IGNORECASE)
    if match:
        pack_size = int(match.group(1))
        if pack_size > 0:
            row['selling_price'] = row['selling_price'] / pack_size
            row['unit_cost'] = row['unit_cost'] / pack_size
    return row

export_df = export_df.apply(process_pack_size, axis=1)

# Round prices to 2 decimal places to keep it clean
export_df['selling_price'] = export_df['selling_price'].round(2)
export_df['unit_cost'] = export_df['unit_cost'].round(2)

export_df.to_csv('importable_products.csv', index=False)
print("Saved to importable_products.csv")
