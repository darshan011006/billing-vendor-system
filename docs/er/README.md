# ER diagram source (Chen notation)

| File | What it is |
| --- | --- |
| `er_model.py` | The model: entity sets with their attributes (key / partial key / derived) and the 23 relationship sets with cardinality and participation |
| `layout_chen.py` | Lays the diagram out: Graphviz places entities and relationships, then each entity's attributes are fanned between its relationship lines; adds the notation legend |
| `er-diagram.dot` | The generated, fully positioned Graphviz file |

Re-generate after changing `er_model.py` (needs Graphviz and Python 3):

```bash
cd docs/er
SEED=43 python3 layout_chen.py er_model.py er-diagram.dot
neato -n2 -Tpng -Gdpi=130 er-diagram.dot -o ../er-diagram.png
neato -n2 -Tsvg er-diagram.dot -o ../er-diagram.svg
```

Leave out `SEED=43` to search the first 120 layouts for the one with the fewest line crossings.

Foreign keys are not drawn as attributes: in Chen notation they are the relationships. The crow's-foot table view of the same schema is `../er-diagram-crowsfoot.png`.
