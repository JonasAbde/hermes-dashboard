import os
import re
import json

def parse_memory_graph(file_path):
    if not os.path.exists(file_path):
        return {"nodes": [], "links": []}

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    nodes = []
    links = []
    
    # Root node for the graph
    nodes.append({
        "id": "Memory",
        "label": "Hukommelse",
        "type": "root",
        "group": 0
    })

    current_h2 = None
    current_h3 = None
    
    # Track existing nodes to avoid duplicates
    node_set = {"Memory"}

    def add_node(id_val, label, n_type, group, content=None):
        if id_val not in node_set:
            node_data = {
                "id": id_val,
                "label": label,
                "type": n_type,
                "group": group
            }
            if content:
                node_data["content"] = content
            nodes.append(node_data)
            node_set.add(id_val)

    for line in lines:
        line = line.strip()
        if not line: continue
        
        # H2 Headers (e.g. ## Jonas Abde)
        h2_match = re.match(r'^##\s+(.+)$', line)
        if h2_match:
            full_header = h2_match.group(1).strip()
            label = full_header.split('—')[0].strip() # Strip extra info for node label
            node_id = f"h2_{label}"
            add_node(node_id, label, "category", 1, content=full_header)
            links.append({"source": "Memory", "target": node_id, "value": 5})
            current_h2 = node_id
            current_h3 = None
            continue
            
        # H3 Headers (e.g. ### Hvem han er)
        h3_match = re.match(r'^###\s+(.+)$', line)
        if h3_match and current_h2:
            label = h3_match.group(1).strip()
            node_id = f"h3_{current_h2}_{label}"
            add_node(node_id, label, "subcategory", 2, content=label)
            links.append({"source": current_h2, "target": node_id, "value": 3})
            current_h3 = node_id
            continue

        # List items (e.g. - 24 år)
        list_match = re.match(r'^[-*]\s+(.+)$', line)
        if list_match and current_h3:
            raw_content = list_match.group(1).strip()
            # Clean label for node (truncate if too long)
            display_label = (raw_content[:30] + '...') if len(raw_content) > 33 else raw_content
            node_id = f"leaf_{current_h3}_{raw_content[:20]}" # Slightly longer id for uniqueness
            add_node(node_id, display_label, "item", 3, content=raw_content)
            links.append({"source": current_h3, "target": node_id, "value": 1})
            continue

    # Final verification: Filter out links that point to missing nodes
    valid_links = [l for l in links if l["source"] in node_set and l["target"] in node_set]

    return {"nodes": nodes, "links": valid_links}

if __name__ == "__main__":
    path = os.path.expanduser('~/.hermes/MEMORY.md')
    graph = parse_memory_graph(path)
    print(json.dumps(graph, indent=2))
