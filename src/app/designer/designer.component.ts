import { Component } from '@angular/core';
import * as go from 'gojs';
@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [],
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.css'
})
export class DesignerComponent {
  private diagram!: go.Diagram;
  private palette!: go.Palette;

  ngOnInit() {
    this.initDiagram();
    this.initPalette();
  }

  private initDiagram() {
    const $ = go.GraphObject.make;
    this.diagram = $(go.Diagram, "diagramDiv", {
      "undoManager.isEnabled": true,
      "draggingTool.dragsLink": true,
      "draggingTool.isGridSnapEnabled": true,
      "linkingTool.isUnconnectedLinkValid": true,
      "linkingTool.portGravity": 20,
      "relinkingTool.isUnconnectedLinkValid": true,
      "relinkingTool.portGravity": 20,
      "grid.visible": true,
      "grid.gridCellSize": new go.Size(10, 10),
      "commandHandler.archetypeGroupData": { isGroup: true, category: "OfNodes" }
    });

    // Plantilla para clases UML
    const nodeTemplate =
      $(go.Node, "Auto",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Shape, "Rectangle",
          {
            fill: "white",
            stroke: "black",
            strokeWidth: 2
          }),
        $(go.Panel, "Table",
          { defaultRowSeparatorStroke: "black" },
          // Nombre de la clase
          $(go.TextBlock,
            {
              row: 0,
              columnSpan: 2,
              margin: 8,
              alignment: go.Spot.Center,
              font: "bold 12pt sans-serif",
              editable: true
            },
            new go.Binding("text", "nombre").makeTwoWay()),

          // Separador
          $(go.RowColumnDefinition, { row: 1, separatorStroke: "black" }),

          // Panel de atributos con título y botón de agregar
          $(go.Panel, "Horizontal",
            {
              row: 1,
              alignment: go.Spot.Left,
              stretch: go.GraphObject.Horizontal,
              margin: new go.Margin(5, 5, 0, 5)
            },
            $("Button",
              {
                alignment: go.Spot.Right,
                width: 20,
                height: 20,
                margin: new go.Margin(0, 0, 0, 10),
                click: (e, obj) => {
                  const node = obj.part;
                  if (node) {
                    const model = this.diagram.model;
                    model.startTransaction("add attribute");
                    const attr = { text: "+ nuevoAtributo: tipo" };
                    const atributos = [...(node.data.atributos || [])];
                    atributos.push(attr);
                    model.setDataProperty(node.data, "atributos", atributos);
                    model.commitTransaction("add attribute");
                  }
                }
              },
              $(go.TextBlock, "+", {
                font: "bold 10pt sans-serif",
                background: "#c8e6c9",
                stroke: "#2e7d32"
              })
            )
          ),

          // Lista de atributos
          $(go.Panel, "Vertical",
            {
              row: 2,
              margin: new go.Margin(5, 5),
              alignment: go.Spot.Left,
              defaultAlignment: go.Spot.Left,
              stretch: go.GraphObject.Horizontal,
              itemTemplate:
                $(go.Panel, "Horizontal",
                  {
                    alignment: go.Spot.Left,
                    stretch: go.GraphObject.Horizontal,
                    margin: new go.Margin(0, 0, 3, 0)
                  },
                  $(go.TextBlock,
                    {
                      editable: true,
                      margin: new go.Margin(0, 0, 0, 0),
                      font: "11pt sans-serif",
                      minSize: new go.Size(100, NaN),
                      stretch: go.GraphObject.Horizontal
                    },
                    new go.Binding("text", "text").makeTwoWay()),
                  $("Button",
                    {
                      alignment: go.Spot.Right,
                      width: 20,
                      height: 20,
                      margin: new go.Margin(0, 5, 0, 0),
                      click: (e, obj) => {
                        const node = obj.part;
                        if (node) {
                          const attrData = obj.panel!.data;
                          const model = this.diagram.model;
                          model.startTransaction("remove attribute");
                          const atributos = [...node.data.atributos];
                          const idx = atributos.findIndex(a => a === attrData);
                          if (idx >= 0) {
                            atributos.splice(idx, 1);
                            model.setDataProperty(node.data, "atributos", atributos);
                          }
                          model.commitTransaction("remove attribute");
                        }
                      }
                    },
                    $(go.TextBlock, "×", {
                      font: "bold 10pt sans-serif",
                      background: "#ffcdd2",
                      stroke: "#d32f2f"
                    })
                  )
                )
            },
            new go.Binding("itemArray", "atributos")
          ),

          // Separador
          $(go.RowColumnDefinition, { row: 3, separatorStroke: "black" }),

          // Panel de métodos con título y botón de agregar
          $(go.Panel, "Horizontal",
            {
              row: 3,
              alignment: go.Spot.Left,
              stretch: go.GraphObject.Horizontal,
              margin: new go.Margin(5, 5, 0, 5)
            },
            $("Button",
              {
                alignment: go.Spot.Right,
                width: 20,
                height: 20,
                margin: new go.Margin(0, 0, 0, 10),
                click: (e, obj) => {
                  const node = obj.part;
                  if (node) {
                    const model = this.diagram.model;
                    model.startTransaction("add method");
                    const method = { text: "+ nuevoMetodo(): tipo" };
                    const metodos = [...(node.data.metodos || [])];
                    metodos.push(method);
                    model.setDataProperty(node.data, "metodos", metodos);
                    model.commitTransaction("add method");
                  }
                }
              },
              $(go.TextBlock, "+", {
                font: "bold 10pt sans-serif",
                background: "#c8e6c9",
                stroke: "#2e7d32"
              })
            )
          ),

          // Lista de métodos
          $(go.Panel, "Vertical",
            {
              row: 4,
              margin: new go.Margin(5, 5),
              alignment: go.Spot.Left,
              defaultAlignment: go.Spot.Left,
              stretch: go.GraphObject.Horizontal,
              itemTemplate:
                $(go.Panel, "Horizontal",
                  {
                    alignment: go.Spot.Left,
                    stretch: go.GraphObject.Horizontal,
                    margin: new go.Margin(0, 0, 3, 0)
                  },
                  $(go.TextBlock,
                    {
                      editable: true,
                      margin: new go.Margin(0, 0, 0, 0),
                      font: "11pt sans-serif",
                      minSize: new go.Size(100, NaN),
                      stretch: go.GraphObject.Horizontal
                    },
                    new go.Binding("text", "text").makeTwoWay()),
                  $("Button",
                    {
                      alignment: go.Spot.Right,
                      width: 20,
                      height: 20,
                      margin: new go.Margin(0, 5, 0, 0),
                      click: (e, obj) => {
                        const node = obj.part;
                        if (node) {
                          const methodData = obj.panel!.data;
                          const model = this.diagram.model;
                          model.startTransaction("remove method");
                          const metodos = [...node.data.metodos];
                          const idx = metodos.findIndex(m => m === methodData);
                          if (idx >= 0) {
                            metodos.splice(idx, 1);
                            model.setDataProperty(node.data, "metodos", metodos);
                          }
                          model.commitTransaction("remove method");
                        }
                      }
                    },
                    $(go.TextBlock, "×", {
                      font: "bold 10pt sans-serif",
                      background: "#ffcdd2",
                      stroke: "#d32f2f"
                    })
                  )
                )
            },
            new go.Binding("itemArray", "metodos")
          )
        ),
        makePort('T', go.Spot.Top, true, true),
        makePort('L', go.Spot.Left, true, true),
        makePort('R', go.Spot.Right, true, true),
        makePort('B', go.Spot.Bottom, true, true)

      );

      function showSmallPorts(node: { ports: { each: (arg0: (port: any) => void) => void; }; }, show: any) {
        node.ports.each((port) => {
          if (port.portId !== '') {
            // NO CAMBIAR EL PUERTO DEFAULT
            port.fill = show ? 'rgba(0,0,0,.3)' : null;
          }
        });
      }
      const linkSelectionAdornmentTemplate = new go.Adornment('Link')
      .add(
        new go.Shape({
          isPanelMain: true, 
          fill: null,
          stroke: 'deepskyblue',
          strokeWidth: 0
        })
      );

     function makePort(name: string, spot: go.Spot, output: boolean, input: boolean) {
        // puertos son ciruclos transparentes que se apegan a las formas
        return new go.Shape('Circle', {
          fill: null, 
          stroke: null,
          desiredSize: new go.Size(7, 7),
          alignment: spot, 
          alignmentFocus: spot, 
          portId: name,
          fromSpot: spot,
          toSpot: spot, 
          fromLinkable: output,
          toLinkable: input,
          cursor: 'pointer' 
        });
      }
      

      /*this.diagram.linkTemplate =
      $(go.Link,
        {
          routing: go.Link.AvoidsNodes,
          curve: go.Link.JumpOver,
          corner: 5,
          relinkableFrom: true,
          relinkableTo: true,
          reshapable: true,
          resegmentable: true
        },
        $(go.Shape, { strokeWidth: 2 }),
        $(go.Shape, { toArrow: "Standard" })
      );*/
        
    this.diagram.linkTemplate = new go.Link({ 
      selectable: true,
      selectionAdornmentTemplate: linkSelectionAdornmentTemplate,
      relinkableFrom: true,
      relinkableTo: true,
      reshapable: true,
      routing: go.Routing.AvoidsNodes,
      curve: go.Curve.JumpOver,
      corner: 5,
      toShortLength: 4
    })
      .bindTwoWay('points')
      .add(
        new go.Shape({ 
          isPanelMain: true,
          strokeWidth: 2
        }),
        new go.Shape({ 
          toArrow: 'Standard',
          stroke: null
        }),
        new go.Panel('Auto')
          .bindObject('visible', 'isSelected')
          .add(
            new go.Shape('RoundedRectangle', { // the link shape
              fill: '#F8F8F8',
              stroke: null
            }),
            new go.TextBlock({
              textAlign: 'center',
              font: '10pt helvetica, arial, sans-serif',
              stroke: '#919191',
              margin: 2,
              minSize: new go.Size(10, NaN),
              editable: true
            }).bindTwoWay('text')
          )
      );


    this.diagram.nodeTemplate = nodeTemplate;

    this.diagram.model = new go.GraphLinksModel([], []);

    // Añadir template para el Actor (stickman)
    const actorTemplate =
      $(go.Node, "Position",  // Cambiamos a "Position" para mejor control
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        // Cabeza
        $(go.Shape, "Circle",
          {
            position: new go.Point(-10, 0),
            width: 20,
            height: 20,
            fill: "white",
            stroke: "black",
            strokeWidth: 2
          }),
        // Cuerpo
        $(go.Shape,
          {
            position: new go.Point(0, 20),
            geometry: new go.Geometry()
              .add(new go.PathFigure(0, 0)
                .add(new go.PathSegment(go.PathSegment.Line, 0, 30))),
            stroke: "black",
            strokeWidth: 2
          }),
        // Brazos
        $(go.Shape,
          {
            position: new go.Point(-20, 30),
            geometry: new go.Geometry()
              .add(new go.PathFigure(0, 0)
                .add(new go.PathSegment(go.PathSegment.Line, 40, 0))),
            stroke: "black",
            strokeWidth: 2
          }),
        // Pierna izquierda
        $(go.Shape,
          {
            position: new go.Point(-15, 50),
            geometry: new go.Geometry()
              .add(new go.PathFigure(0, 0)
                .add(new go.PathSegment(go.PathSegment.Line, -15, 25))),
            stroke: "black",
            strokeWidth: 2
          }),
        // Pierna derecha
        $(go.Shape,
          {
            position: new go.Point(0, 50),
            geometry: new go.Geometry()
              .add(new go.PathFigure(0, 0)
                .add(new go.PathSegment(go.PathSegment.Line, 15, 25))),
            stroke: "black",
            strokeWidth: 2
          }),
        // Nombre del actor
        $(go.TextBlock,
          {
            position: new go.Point(-30, 80),
            width: 60,
            textAlign: "center",
            editable: true
          },
          new go.Binding("text", "nombre").makeTwoWay())
      );

    // Template para Caso de Uso (elipse)
    const casoUsoTemplate =
      $(go.Node, "Auto",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Shape, "Ellipse",
          {
            fill: "white",
            stroke: "black",
            strokeWidth: 2,
            width: 120,
            height: 60
          }),
        $(go.TextBlock,
          {
            margin: 8,
            editable: true,
            textAlign: "center",
            wrap: go.TextBlock.WrapFit
          },
          new go.Binding("text", "nombre").makeTwoWay())
      );

    // Template para el Sistema (rectángulo contenedor)
    const sistemaTemplate =
  $(go.Group, "Auto",
    {
      isSubGraphExpanded: true,
      movable: true,
      handlesDragDropForMembers: true,
      computesBoundsAfterDrag: true,
      // Permite que solo se agreguen nodos de la categoría "CasoUso"
      memberValidation: (group: any, node: any) => node.category === "CasoUso",
      // Al soltar nodos sobre el grupo, se agregan como miembros
      mouseDrop: function(e, grp) {
        const diagram = grp.diagram;
        const tool = diagram!.currentTool as any;
        if (!tool.doingDragSelecting) {
          e.handled = true;
          const group = grp as go.Group; // Convertimos grp a go.Group
          const groupKey = group.data.key; // Accedemos a la key desde data
          diagram!.model.startTransaction("grouping");
          diagram!.selection.each((part: go.Part) => {
            if (part instanceof go.Node && part.category === "CasoUso") {
              diagram!.model.setDataProperty(part.data, "group", groupKey);
            }
          });
          diagram!.model.commitTransaction("grouping");
        }
      }
      
      
      
      
    },
    // Forma del grupo
    $(go.Shape, "Rectangle",
      {
        name: "SHAPE",
        fill: "white",
        stroke: "black",
        strokeWidth: 2,
        minSize: new go.Size(200, 200)
      },
      new go.Binding("desiredSize", "size", go.Size.parse).makeTwoWay(go.Size.stringify)
    ),
    // Panel que contiene el título y los miembros (Placeholder)
    $(go.Panel, "Vertical",
      $(go.TextBlock,
        {
          alignment: go.Spot.Top,
          margin: 8,
          editable: true,
          font: "bold 12pt sans-serif"
        },
        new go.Binding("text", "nombre").makeTwoWay()),
      $(go.Placeholder,  // Aquí se colocan los miembros del grupo
         { padding: 5, background: "transparent" }
      )
    )
  );


    this.diagram.addDiagramListener("ExternalObjectsDropped", (e) => {
      e.subject.each((part: Node) => {
        if (part instanceof go.Node && part.category === "CasoUso" && part.containingGroup === null) {
          alert("Los casos de uso deben colocarse dentro de un sistema.");
          // Remueve el nodo si no se encuentra dentro de un grupo
          this.diagram.remove(part);
        }
      });
    });
    
  


    // Registrar los templates
    this.diagram.nodeTemplateMap.add("Actor", actorTemplate);
    this.diagram.nodeTemplateMap.add("CasoUso", casoUsoTemplate);
    //this.diagram.nodeTemplateMap.add("Sistema", sistemaTemplate);
    this.diagram.groupTemplateMap.add("Sistema", sistemaTemplate);

  }

   exportDiagram() {
    const json = this.diagram.model.toJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  importDiagram(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        this.diagram.model = go.Model.fromJson(text);
      };
      reader.readAsText(input.files[0]);
    }
  }

  private initPalette() {
    const $ = go.GraphObject.make;
    this.palette = $(go.Palette, "paletteDiv",
      {
        maxSelectionCount: 1,
        nodeTemplateMap: this.diagram.nodeTemplateMap,
        groupTemplateMap: this.diagram.groupTemplateMap,
        linkTemplate: this.diagram.linkTemplate,
        model: new go.GraphLinksModel([
          {
            key: "Clase",
            nombre: "NombreClase",
            atributos: [{ text: "+ atributo1: tipo" }],
            metodos: [{ text: "+ metodo1(): tipo" }]
          },
          // Añadir nuevos elementos a la paleta
          { 
            key: "Actor", 
            category: "Actor",
            nombre: "Actor" 
          },
          { 
            key: "CasoUso", 
            category: "CasoUso",
            nombre: "Caso de Uso" 
          },
          {
            key: "Sistema",
            category: "Sistema",
            nombre: "Sistema",
            isGroup: true,
            width: 200,
            height: 300
          }
        ], [
          { points: new go.List(/*go.Point*/).addAll([new go.Point(0, 0), new go.Point(30, 0), new go.Point(30, 40), new go.Point(60, 40)]) }
        ])
      });
  }
  
}

