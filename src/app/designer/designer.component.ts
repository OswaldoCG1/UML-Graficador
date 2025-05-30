import { Component } from '@angular/core';
import * as go from 'gojs';
import jsPDF from 'jspdf';
import { CodeGeneratorComponent } from "../code-generator/code-generator.component";  

// Herramientas personalizadas para diagramas de secuencia
class SequenceLinkingTool extends go.LinkingTool {
  constructor() {
    super();
  }

  override insertLink(fromNode: go.Node, fromPort: go.GraphObject, toNode: go.Node, toPort: go.GraphObject): go.Link | null {
    const newlink = super.insertLink(fromNode, fromPort, toNode, toPort);
    if (newlink) {
      newlink.data.category = "Message";
      newlink.data.mensaje = "Nuevo mensaje";
      // Usar texto consistente con el ejemplo de secuencia
      newlink.data.text = "Escribe aquí...";
    }
    return newlink;
  }
}

class SequenceDraggingTool extends go.DraggingTool {
  constructor() {
    super();
  }

  override moveParts(parts: go.Map<go.Part, go.DraggingInfo>, offset: go.Point, check?: boolean): void {
    const result = super.moveParts(parts, offset, check);
    parts.each(part => {
      if (part instanceof go.Node && part.category === "Lifeline") {
        // Uso de duración consistente con el ejemplo de secuencia
        const newHeight = part.data.duration + (offset.y > 0 ? 10 : -10);
        this.diagram.model.setDataProperty(part.data, "duration", Math.max(100, newHeight));
      }
    });
    return result;
  }
}

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CodeGeneratorComponent],
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.css'
})
export class DesignerComponent {
  private diagram!: go.Diagram;
  private palette!: go.Palette;

  public get diagramData() {
    return this.diagram ? this.diagram.model.toJson() : null;
  }

  public selectedLinkCategory: string = "";

  public setLinkCategory(category: string) {
    this.selectedLinkCategory = category;
    // Cambia la categoría por defecto del LinkingTool
    console.log(`Setting link category to: ${category}`);
    if (this.diagram) {
      (this.diagram.toolManager.linkingTool as any).linkCategory = category;
    }
  }

  ngOnInit() {
    this.initDiagram();
    this.initPalette();

    // Inicializa la categoría por defecto
    this.setLinkCategory('');
  }

  private initDiagram() {
    const $ = go.GraphObject.make;

    // Configuración principal del diagrama
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

    // Instalar herramientas personalizadas para diagramas de secuencia
    this.diagram.toolManager.linkingTool = new SequenceLinkingTool();
    this.diagram.toolManager.draggingTool = new SequenceDraggingTool();

    // ================== PLANTILLAS PARA DIAGRAMA DE SECUENCIA ==================
    // Template para líneas de vida (Lifeline)
    const lifelineTemplate = $(go.Group, "Vertical",
      {
        locationSpot: go.Spot.Top,
        selectionObjectName: "HEADER",
        computesBoundsAfterDrag: true,
        handlesDragDropForMembers: true,
        groupable: true,
        mouseDrop: function (e, grp) {
          const ok = grp instanceof go.Group && grp.diagram && grp.canAddMembers(grp.diagram.selection);
          if (!ok) return;
          e.diagram.selection.each(part => {
            if (part instanceof go.Node) part.containingGroup = grp;
          });
        },
        fromLinkable: false,
        toLinkable: false
      },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(
        go.Panel, "Auto", { name: "HEADER" },
        $(go.Shape, "Rectangle", { fill: "#bbdefb", stroke: null }),
        $(go.TextBlock,
          {
            editable: true,
            margin: 5,
            font: "10pt sans-serif"
          },
          new go.Binding("text", "nombre").makeTwoWay())
      ),
      $(
        go.Shape,
        { figure: "LineV", stroke: "gray", strokeDashArray: [3, 3], width: 1 },
        new go.Binding("height", "duration")
      )
    );

    // Template para mensajes entre líneas de vida
    const messageTemplate = $(
      go.Link,
      { curve: go.Link.JumpOver, toShortLength: 2, relinkableFrom: true, relinkableTo: true },
      $(go.Shape, { stroke: "black" }),
      $(go.Shape, { toArrow: "OpenTriangle", stroke: "black" }),
      $(go.Panel, "Auto",
        $(go.Shape, "Rectangle", { fill: "white", stroke: "black" }),
        $(go.TextBlock, 'escribe aqui...',
          {
            font: "9pt sans-serif",
            margin: 2,
            editable: true,
            segmentIndex: 0,
            segmentOffset: new go.Point(0, -20)
          },
          new go.Binding("text", "text").makeTwoWay()
        )
      )
    );

    // Registrar plantillas de secuencia
    this.diagram.groupTemplateMap.add("Lifeline", lifelineTemplate);
    this.diagram.linkTemplateMap.add("Message", messageTemplate);

    // ================== PLANTILLAS EXISTENTES ==================

    // Función helper para crear puertos
    function makePort(name: string, spot: go.Spot, output: boolean, input: boolean) {
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

    function showSmallPorts(node: { ports: { each: (arg0: (port: any) => void) => void; }; }, show: any) {
      node.ports.each((port) => {
        if (port.portId !== '') {
          port.fill = show ? 'rgba(0,0,0,.3)' : null;
        }
      });
    }

    // Plantilla para clases UML
    const nodeTemplate =
      $(go.Node, "Auto",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          mouseEnter: (e, node) => showPorts(node, true),
          mouseLeave: (e, node) => showPorts(node, false)
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
              margin: new go.Margin(5, 5, 0, 5),
              name: "ATTR_SECTION",
            },
            $("Button",
              {
                name: "ADD_ATTR_BTN",
                visible: true,
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
                },
                "_buttonClass": "class-add-btn"
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
                    margin: new go.Margin(0, 0, 3, 0),
                              name: "ATTR_ROW",
                    mouseEnter: (e, obj) => {
                            const panel = obj as go.Panel;
                            const btn = panel.findObject("REMOVE_ATTR_BTN");
                            if (btn) btn.visible = true;
                          },
                          mouseLeave: (e, obj) => {
                            const panel = obj as go.Panel;
                            const btn = panel.findObject("REMOVE_ATTR_BTN");
                            if (btn) btn.visible = false;
                          }
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
                              name: "REMOVE_ATTR_BTN",
                      visible: false,
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
                      },
                                  "_buttonClass": "class-remove-btn"
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
              margin: new go.Margin(5, 5, 0, 5),
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
                },
                "_buttonClass": "method-add-btn"
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
                    margin: new go.Margin(0, 0, 3, 0),
                          mouseEnter: (e, obj) => {
                            const panel = obj as go.Panel;
                            const btn = panel.findObject("REMOVE_METHOD_BTN");
                            if (btn) btn.visible = true;
                          },
                          mouseLeave: (e, obj) => {
                            const panel = obj as go.Panel;
                            const btn = panel.findObject("REMOVE_METHOD_BTN");
                            if (btn) btn.visible = false;
                          }
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
                      name: "REMOVE_METHOD_BTN",
                      alignment: go.Spot.Right,
                      visible: false,
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
                      },
                      "_buttonClass": "method-remove-btn"
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
        makePort('B', go.Spot.Bottom, true, true),
      );

    // Plantilla para adornar enlaces seleccionados
    const linkSelectionAdornmentTemplate = new go.Adornment('Link')
      .add(
        new go.Shape({
          isPanelMain: true,
          fill: null,
          stroke: 'deepskyblue',
          strokeWidth: 0
        })
      );

    // Plantilla general para enlaces
    const generalLinkTemplate = new go.Link({
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
            new go.Shape('RoundedRectangle', {
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
    this.diagram.linkTemplate = generalLinkTemplate;

    // Actor (stickman)
    const actorTemplate =
      $(go.Node, "Position",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
           mouseEnter: (e, node) => showPorts(node, true),
          mouseLeave: (e, node) => showPorts(node, false)
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
          new go.Binding("text", "nombre").makeTwoWay()),
          makePort('T', go.Spot.Top, true, true),
       // makePort('L', go.Spot.Left, true, true),
     //   makePort('R', go.Spot.Right, true, true),
     //   makePort('B', go.Spot.Bottom, true, true),
      );

    // Caso de Uso (elipse)
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
          new go.Binding("text", "nombre").makeTwoWay()),
        makePort('T', go.Spot.Top, true, true),
        makePort('L', go.Spot.Left, true, true),
        makePort('R', go.Spot.Right, true, true),
        makePort('B', go.Spot.Bottom, true, true),
      );

    // Sistema (rectángulo contenedor)
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
              const group = grp as go.Group;
              const groupKey = group.data.key;
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
          $(go.Placeholder,
            { padding: 5, background: "transparent" }
          )
        )
      );

    // Plantilla para los nodos de acción
    const actionNodeTemplate = $(
      go.Node, "Auto",
      {
        locationSpot: go.Spot.Top,
        movable: true,
        groupable: true,
        dragComputation: (node: go.Part, pt: go.Point) => {
          return node.containingGroup ? new go.Point(node.containingGroup.location.x, pt.y) : pt;
        }
      },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding("group", "group"),
      $(
        go.Panel, "Vertical",
        $(go.Shape, "Rectangle", {
          fill: "white",
          stroke: "black",
          width: 20,  // Aumentar ancho para mayor visibilidad
          height: 30
        }),
        $(go.Shape, "Rectangle", {
          fill: "black",
          width: 20,  // Aumentar ancho para mayor visibilidad
          height: 3
        }),
        $(go.Shape, "Circle",
          {
            width: 10,  // Aumentar tamaño del círculo
            height: 10, // Aumentar tamaño del círculo
            fill: "red",
            strokeWidth: 0,
            cursor: "pointer",
            portId: "",
            fromLinkable: true,
            toLinkable: true,
            fromSpot: go.Spot.Bottom,
            toSpot: go.Spot.Top
          }
        )
      )
    );

    // Plantilla para nodos de texto libre
    const textNodeTemplate = $(go.Node, "Auto",
      {
        locationSpot: go.Spot.Center,
        resizable: true,
        resizeObjectName: "SHAPE",
        movable: true
      },
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Shape, "Rectangle", {
        name: "SHAPE",
        fill: "rgba(255,255,255,0.9)",
        stroke: "rgba(0,0,0,0.2)",
        strokeWidth: 1,
        minSize: new go.Size(60, 20)
      }),
      $(go.TextBlock, {
        margin: 8,
        font: "11pt sans-serif",
        editable: true,
        isMultiline: true,
        wrap: go.TextBlock.WrapFit,
        textAlign: "center"
      }, new go.Binding("text", "texto").makeTwoWay())
    );

    this.diagram.addDiagramListener("ExternalObjectsDropped", (e) => {
      e.subject.each((part: go.Part) => {
        if (part instanceof go.Node && part.category === "CasoUso" && part.containingGroup === null) {
          alert("Los casos de uso deben colocarse dentro de un sistema.");
          this.diagram.remove(part);
        }
        if (part instanceof go.Node && part.data) {
            // Clona los arrays para evitar referencias compartidas
            if (Array.isArray(part.data.atributos)) {
              this.diagram.model.setDataProperty(part.data, "atributos", part.data.atributos.map((a: any) => ({ ...a })));
            }
            if (Array.isArray(part.data.metodos)) {
              this.diagram.model.setDataProperty(part.data, "metodos", part.data.metodos.map((m: any) => ({ ...m })));
            }
        }
      });
    });

    // Registrar los templates
    this.diagram.nodeTemplateMap.add("Actor", actorTemplate);
    this.diagram.nodeTemplateMap.add("CasoUso", casoUsoTemplate);
    this.diagram.groupTemplateMap.add("Sistema", sistemaTemplate);
    this.diagram.groupTemplateMap.add("Lifeline", lifelineTemplate);
    this.diagram.nodeTemplateMap.add("Action", actionNodeTemplate);
    this.diagram.linkTemplateMap.add("Message", messageTemplate);
    this.diagram.nodeTemplateMap.add("TextNode", textNodeTemplate); // Añadir la plantilla de texto

    // Evento para evitar que los enlaces queden vacíos después de editarse
    this.diagram.addDiagramListener("TextEdited", (e) => {
      const tb = e.subject as go.TextBlock;
      if (tb && tb.part && tb.part.data && tb.text.trim() === "") {
        this.diagram.model.setDataProperty(tb.part.data, "text", "Escribe aquí...");
      }
    });

    // ================== PLANTILLAS PARA DIAGRAMA DE COMPONENTES ==================
    
    // Template para Componente con el estilo de la imagen
    const componentTemplate = 
      $(go.Node, "Auto",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          resizable: true,
          resizeObjectName: "SHAPE"
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Shape, "Rectangle",
          {
            name: "SHAPE",
            fill: "#90EE90",  // Color verde claro para LMS database
            stroke: "black",
            strokeWidth: 1,
            minSize: new go.Size(100, 60)
          }),
        // Ícono en la esquina superior derecha
        $(go.Panel, "Horizontal",
          { alignment: go.Spot.TopRight, alignmentFocus: new go.Spot(1, 0, -5, 5) },
          $(go.Shape, "Rectangle",
            {
              width: 12, height: 12,
              fill: "white", 
              stroke: "black",
              strokeWidth: 1
            })
        ),
        // Puntos de anclaje interactivos
        $(go.Shape, "Circle",
          {
            width: 6, height: 6,
            fill: "white",
            stroke: "black",
            strokeWidth: 1,
            position: new go.Point(0, 30),
            alignment: go.Spot.Left,
            portId: "leftPort",
            fromLinkable: true,
            toLinkable: true,
            cursor: "pointer",
            fromSpot: go.Spot.Left,
            toSpot: go.Spot.Left
          }),
        $(go.Shape, "Circle",
          {
            width: 6, height: 6,
            fill: "white",
            stroke: "black",
            strokeWidth: 1,
            position: new go.Point(100, 30),
            alignment: go.Spot.Right,
            portId: "rightPort",
            fromLinkable: true,
            toLinkable: true,
            cursor: "pointer",
            fromSpot: go.Spot.Right,
            toSpot: go.Spot.Right
          }),
        $(go.TextBlock,
          {
            margin: new go.Margin(8, 8, 8, 8),
            editable: true,
            font: "11pt sans-serif",
            stroke: "black"
          },
          new go.Binding("text", "nombre").makeTwoWay())
        );

    // Template para Interface con el estilo de la imagen
    const interfaceTemplate =
      $(go.Node, "Auto",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          resizable: true,
          resizeObjectName: "SHAPE"
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Shape, "Rectangle",
          {
            name: "SHAPE",
            fill: "#ADD8E6",  // Color azul claro para Book
            stroke: "black",
            strokeWidth: 1,
            minSize: new go.Size(100, 40)
          }),
        // Ícono en la esquina superior derecha
        $(go.Panel, "Horizontal",
          { alignment: go.Spot.TopRight, alignmentFocus: new go.Spot(1, 0, -5, 5) },
          $(go.Shape, "Rectangle",
            {
              width: 12, height: 12,
              fill: "white",
              stroke: "black",
              strokeWidth: 1
            })
        ),
        // Puntos de anclaje interactivos
        $(go.Shape, "Circle",
          {
            width: 6, height: 6,
            fill: "white",
            stroke: "black",
            strokeWidth: 1,
            position: new go.Point(0, 20),
            alignment: go.Spot.Left,
            portId: "leftPort",
            fromLinkable: true,
            toLinkable: true,
            cursor: "pointer",
            fromSpot: go.Spot.Left,
            toSpot: go.Spot.Left
          }),
        $(go.Shape, "Circle",
          {
            width: 6, height: 6,
            fill: "white",
            stroke: "black",
            strokeWidth: 1,
            position: new go.Point(100, 20),
            alignment: go.Spot.Right,
            portId: "rightPort",
            fromLinkable: true,
            toLinkable: true,
            cursor: "pointer",
            fromSpot: go.Spot.Right,
            toSpot: go.Spot.Right
          }),
        $(go.TextBlock,
          {
            margin: 8,
            editable: true,
            font: "11pt sans-serif",
            stroke: "black"
          },
          new go.Binding("text", "nombre").makeTwoWay())
        );

    // Template para Dependencia con círculo en el medio
    const dependencyLinkTemplate =
      $(go.Link,
        {
          selectable: true,
          routing: go.Link.AvoidsNodes,
          corner: 5,
          curve: go.Link.JumpOver,
          toShortLength: 4,
          relinkableFrom: true,
          relinkableTo: true,
          reshapable: true,
          resegmentable: true,
          cursor: "pointer"
        },
        new go.Binding("points").makeTwoWay(),
        $(go.Shape,
          {
            strokeWidth: 1.5,
            stroke: "black",
            strokeDashArray: [4, 2]  // Línea punteada
          }),
        // Círculo en el medio de la línea
        $(go.Shape, "Circle",
          {
            width: 6, height: 6,
            fill: "white",
            stroke: "black",
            strokeWidth: 1,
            segmentIndex: 0,
            segmentFraction: 0.5  // Esto lo coloca en el medio de la línea
          })
      );

    // Template para Flecha Universal
    const universalLinkTemplate =
      $(go.Link,
        {
          selectable: true,
          selectionAdornmentTemplate: linkSelectionAdornmentTemplate, // usa el existente
          routing: go.Link.Normal,  // enrutamiento simple
          relinkableFrom: true,
          relinkableTo: true,
          reshapable: true,         // permite modificar la forma
          resegmentable: true,      // permite añadir puntos de control
          toEndSegmentLength: 50,   // longitud del segmento final
          fromEndSegmentLength: 50, // longitud del segmento inicial
          cursor: "pointer"
        },
        new go.Binding("points").makeTwoWay(),
        $(go.Shape,
          {
            isPanelMain: true,
            strokeWidth: 2,
            stroke: "black",
          }),
        $(go.Shape,
          {
            toArrow: "Standard",
            stroke: "black",
            fill: "black",
            scale: 1
          })
      );

    // Template para Círculo con texto y puntos de conexión
    const circleTemplate = 
      $(go.Node, "Vertical",
        {
          locationSpot: go.Spot.Center,
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          resizable: true,
          resizeObjectName: "SHAPE"
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        // Texto editable arriba del círculo
        $(go.TextBlock,
          {
            margin: new go.Margin(0, 0, 2, 0),
            editable: true,
            font: "9pt sans-serif"
          },
          new go.Binding("text", "nombre").makeTwoWay()),
        // Panel para el círculo y sus puntos de conexión
        $(go.Panel, "Auto",
          $(go.Shape, "Circle",
            {
              name: "SHAPE",
              fill: "white",
              stroke: "black",
              strokeWidth: 1,
              width: 10,
              height: 10,
              minSize: new go.Size(8, 8)
            }),
          // Puntos de anclaje interactivos
          $(go.Shape, "Circle",
            {
              width: 6, height: 6,
              fill: "white",
              stroke: "black",
              strokeWidth: 1,
              position: new go.Point(-5, 0),
              alignment: go.Spot.Left,
              portId: "leftPort",
              fromLinkable: true,
              toLinkable: true,
              cursor: "pointer"
            }),
          $(go.Shape, "Circle",
            {
              width: 6, height: 6,
              fill: "white",
              stroke: "black",
              strokeWidth: 1,
              position: new go.Point(5, 0),
              alignment: go.Spot.Right,
              portId: "rightPort",
              fromLinkable: true,
              toLinkable: true,
              cursor: "pointer"
            })
        )
      );

    // ================== PLANTILLAS PARA DIAGRAMA DE PAQUETES ==================
    
    // Definir la función showPorts antes de usarla
    function showPorts(node: any, show: boolean): void {
      if (!node || !(node instanceof go.Node)) return;
      node.ports.each((port: any) => {
        if (port.portId !== "") {
          // Cast explícito a go.Shape
          (port as go.Shape).fill = show ? "rgba(0,0,0,.3)" : null;
        }
      });
    }

    // Template para Paquete UML
    const packageTemplate =
      $(go.Group, "Auto",
        {
          locationSpot: go.Spot.Center,
          resizable: true,
          resizeObjectName: "MAIN",
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          // Propiedades para que funcione como contenedor
          isSubGraphExpanded: true,
          // Layout para elementos internos
          layout: $(go.GridLayout, {
            wrappingColumn: 2,
            spacing: new go.Size(10, 10),
            alignment: go.GridLayout.Position
          }),
          // Mostrar puertos al pasar el ratón - corregidos los tipos
          mouseEnter: function(e: go.InputEvent, obj: go.GraphObject) {
            const part = obj.part;
            if (part) showPorts(part, true);
          },
          mouseLeave: function(e: go.InputEvent, obj: go.GraphObject) {
            const part = obj.part;
            if (part) showPorts(part, false);
          }
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Panel, "Position",
          // La pestaña superior
          $(go.Panel, "Auto",
            {
              position: new go.Point(0, 0),
              width: 55,
              height: 15
            },
            $(go.Shape, "Rectangle",
              {
                fill: "white",
                stroke: "black",
                strokeWidth: 1
              }
            ),
            $(go.TextBlock,
              {
                margin: 2,
                editable: true,
                font: "10pt sans-serif"
              },
              new go.Binding("text", "nombre").makeTwoWay())
          ),
          // El cuerpo principal del paquete
          $(go.Panel, "Auto",
            {
              name: "MAIN",
              position: new go.Point(0, 15),
              minSize: new go.Size(100, 60)
            },
            $(go.Shape, "Rectangle",
              {
                fill: "white",
                stroke: "black",
                strokeWidth: 1
              }
            ),
            $(go.Placeholder,
              {
                padding: 5
              }
            ),
            // Texto dentro del rectángulo principal
            $(go.TextBlock,
              {
                margin: 5,
                editable: true,
                font: "10pt sans-serif",
                alignment: go.Spot.TopLeft
              },
              new go.Binding("text", "attributes").makeTwoWay())
          ),
          
          // Usar makePort en lugar de definir los círculos directamente
          makePort("L", go.Spot.Left, true, true),
          makePort("R", go.Spot.Right, true, true)
        )
      );

     const package2Template =
      $(go.Group, "Auto",
        {
          locationSpot: go.Spot.Center,
          resizable: true,
          resizeObjectName: "MAIN",
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          // Propiedades para que funcione como contenedor
          isSubGraphExpanded: true,
          // Layout para elementos internos
          layout: $(go.GridLayout, {
            wrappingColumn: 2,
            spacing: new go.Size(10, 10),
            alignment: go.GridLayout.Position
          }),
          // Mostrar puertos al pasar el ratón - corregidos los tipos
          mouseEnter: function(e: go.InputEvent, obj: go.GraphObject) {
            const part = obj.part;
            if (part) showPorts(part, true);
          },
          mouseLeave: function(e: go.InputEvent, obj: go.GraphObject) {
            const part = obj.part;
            if (part) showPorts(part, false);
          }
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Panel, "Position",
          // La pestaña superior
          $(go.Panel, "Auto",
            {
              position: new go.Point(0, 0),
              width: 55,
              height: 15
            },
            $(go.Shape, "Rectangle",
              {
                fill: "white",
                stroke: "black",
                strokeWidth: 1
              }
            ),
            $(go.TextBlock,
              {
                margin: 2,
                editable: true,
                font: "10pt sans-serif"
              },
              new go.Binding("text", "nombre").makeTwoWay())
          ),
          // El cuerpo principal del paquete
          $(go.Panel, "Auto",
            {
              name: "MAIN",
              position: new go.Point(0, 15),
              minSize: new go.Size(100, 60)
            },
            $(go.Shape, "Rectangle",
              {
                fill: "white",
                stroke: "black",
                strokeWidth: 1
              }
            ),
            $(go.Placeholder,
              {
                padding: 5
              }
            ),
            // Texto dentro del rectángulo principal
            $(go.TextBlock,
              {
                margin: 5,
                editable: true,
                font: "10pt sans-serif",
                alignment: go.Spot.TopLeft
              },
              new go.Binding("text", "attributes").makeTwoWay())
          ),
          
          // Usar makePort en lugar de definir los círculos directamente
          makePort("L", go.Spot.Left, true, true),
          makePort("R", go.Spot.Right, true, true)
        )
      );

    // Flecha de dependencia entre paquetes
    const packageDependencyTemplate =
      $(go.Link,
        {
          routing: go.Link.AvoidsNodes,
          curve: go.Link.JumpOver,
          corner: 5,
          toShortLength: 4,
          relinkableFrom: true,
          relinkableTo: true,
          reshapable: true,
          resegmentable: true
        },
        new go.Binding("points").makeTwoWay(),
        $(go.Shape,
          {
            stroke: "black",
            strokeWidth: 1.5,
            strokeDashArray: [4, 2]
          }),
        $(go.Shape,
          {
            toArrow: "OpenTriangle",
            stroke: "black",
            fill: null
          })
      );

    // Registrar las plantillas
    this.diagram.nodeTemplateMap.add("Componente", componentTemplate);
    this.diagram.nodeTemplateMap.add("Interface", interfaceTemplate);
    this.diagram.linkTemplateMap.add("Dependencia", dependencyLinkTemplate);
    this.diagram.linkTemplateMap.add("UniversalLink", universalLinkTemplate);
    this.diagram.nodeTemplateMap.add("Circle", circleTemplate);
    this.diagram.groupTemplateMap.add("Package", packageTemplate);
    this.diagram.groupTemplateMap.add("MVC", packageTemplate);
    this.diagram.linkTemplateMap.add("PackageDependency", packageDependencyTemplate);

    // Template para el Contenedor
    const containerTemplate =
      $(go.Group, "Auto",
        {
          background: "transparent",
          locationSpot: go.Spot.Center,
          resizable: true,
          resizeObjectName: "MAIN",
          isSubGraphExpanded: true,
          layout: $(go.Layout),
          fromSpot: go.Spot.AllSides,
          toSpot: go.Spot.AllSides,
          mouseEnter: function(e: go.InputEvent, obj: go.GraphObject) {
            const group = obj.part as go.Group;
            if (group) showPorts(group, true);
          },
          mouseLeave: function(e: go.InputEvent, obj: go.GraphObject) {
            const group = obj.part as go.Group;
            if (group) showPorts(group, false);
          },
          mouseDrop: function(e: go.InputEvent, grp: go.GraphObject) {
            const diagram = grp.diagram;
            if (!diagram) return;
            
            const group = grp as go.Group;
            const offset = group.diagram!.lastInput.documentPoint;
            
            diagram.startTransaction("agregar a contenedor");
            diagram.selection.each(function(part: go.Part) {
              if (part instanceof go.Part) {
                // Mantener la posición relativa al soltar
                const loc = part.location.copy();
                diagram.model.setDataProperty(part.data, "group", group.data.key);
                diagram.model.setDataProperty(part.data, "loc", go.Point.stringify(loc));
              }
            });
            diagram.commitTransaction("agregar a contenedor");
          },
          memberValidation: function(group: go.Group, part: go.Part) {
            return true; // Permitir cualquier elemento
          },
          handlesDragDropForMembers: true,
          mouseDragEnter: function(e: go.InputEvent, group: go.GraphObject) {
            if (!(group instanceof go.Group)) return;
            group.isHighlighted = true;
          },
          mouseDragLeave: function(e: go.InputEvent, group: go.GraphObject) {
            if (!(group instanceof go.Group)) return;
            group.isHighlighted = false;
          },
          computesBoundsAfterDrag: true,
          computesBoundsIncludingLinks: true,
          computesBoundsIncludingLocation: true
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        $(go.Panel, "Vertical",
          $(go.Panel, "Auto",
            {
              name: "HEADER",
              alignment: go.Spot.Top
            },
            $(go.Shape, "Rectangle",
              {
                fill: "white",
                stroke: "black",
                strokeWidth: 1
              }
            ),
            $(go.TextBlock,
              {
                margin: new go.Margin(5, 8),
                font: "11pt sans-serif",
                editable: true
              },
              new go.Binding("text", "nombre").makeTwoWay())
          ),
          $(go.Panel, "Auto",
            {
              name: "MAIN",
              stretch: go.GraphObject.Fill
            },
            $(go.Shape, "Rectangle",
              {
                name: "SHAPE",
                fill: "white",
                stroke: "black",
                strokeWidth: 2,
                minSize: new go.Size(150, 100)
              }
            ),
            $(go.Shape, "Circle",  // Puerto superior
              {
                alignment: go.Spot.Top,
                alignmentFocus: go.Spot.Top,
                portId: "T",
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                fill: "white",
                stroke: "black",
                desiredSize: new go.Size(8, 8)
              }),
            $(go.Shape, "Circle",  // Puerto izquierdo
              {
                alignment: go.Spot.Left,
                alignmentFocus: go.Spot.Left,
                portId: "L",
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                fill: "white",
                stroke: "black",
                desiredSize: new go.Size(8, 8)
              }),
            $(go.Shape, "Circle",  // Puerto derecho
              {
                alignment: go.Spot.Right,
                alignmentFocus: go.Spot.Right,
                portId: "R",
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                fill: "white",
                stroke: "black",
                desiredSize: new go.Size(8, 8)
              }),
            $(go.Shape, "Circle",  // Puerto inferior
              {
                alignment: go.Spot.Bottom,
                alignmentFocus: go.Spot.Bottom,
                portId: "B",
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer",
                fill: "white",
                stroke: "black",
                desiredSize: new go.Size(8, 8)
              }),
            $(go.Placeholder,
              {
                padding: 10,
                alignment: go.Spot.Center,
                alignmentFocus: go.Spot.Center
              }
            )
          )
        )
      );

    // Agregar el template al diagrama
    this.diagram.groupTemplateMap.add("Container", containerTemplate);

    // Herencia (Generalization): Flecha con triángulo blanco
    const inheritanceLinkTemplate = $(go.Link,
      {
        routing: go.Link.AvoidsNodes,
        curve: go.Curve.JumpOver,
        corner: 5,
        relinkableFrom: true,
        relinkableTo: true,
        reshapable: true,
        toShortLength: 8
      },
      $(go.Shape, { stroke: "black", strokeWidth: 2 }),
      $(go.Shape, {
        toArrow: "Triangle",
        fill: "white",
        stroke: "black",
        strokeWidth: 2,
        scale: 1.2
      })
    );

    // Agregación Simple: Rombo blanco en el origen
    const aggregationLinkTemplate = $(go.Link,
      {
        routing: go.Link.AvoidsNodes,
        curve: go.Curve.JumpOver,
        corner: 5,
        relinkableFrom: true,
        relinkableTo: true,
        reshapable: true,
        toShortLength: 8
      },
      $(go.Shape, { stroke: "black", strokeWidth: 2 }),
      $(go.Shape, {
        fromArrow: "Diamond",
        fill: "white",
        stroke: "black",
        strokeWidth: 2,
        scale: 1.2
      }),
      $(go.Shape, {
        toArrow: "",
        stroke: "black"
      })
    );

    // Agregación Múltiple: Rombo negro en el origen
    const multiAggregationLinkTemplate = $(go.Link,
      {
        routing: go.Link.AvoidsNodes,
        curve: go.Curve.JumpOver,
        corner: 5,
        relinkableFrom: true,
        relinkableTo: true,
        reshapable: true,
        toShortLength: 8
      },
      $(go.Shape, { stroke: "black", strokeWidth: 2 }),
      $(go.Shape, {
        fromArrow: "Diamond",
        fill: "black",
        stroke: "black",
        strokeWidth: 2,
        scale: 1.2
      }),
      $(go.Shape, {
        toArrow: "",
        stroke: "black"
      })
    );

    // Registrar los nuevos templates
    this.diagram.linkTemplateMap.add("Herencia", inheritanceLinkTemplate);
    this.diagram.linkTemplateMap.add("Agregacion", aggregationLinkTemplate);
    this.diagram.linkTemplateMap.add("AgregacionMultiple", multiAggregationLinkTemplate);
    
    const linkingTool = this.diagram.toolManager.linkingTool;
    const originalInsertLink = linkingTool.insertLink;
    linkingTool.insertLink = (fromNode, fromPort, toNode, toPort) => {
      const link = originalInsertLink.call(linkingTool, fromNode, fromPort, toNode, toPort);
      if (link && this.selectedLinkCategory) {
        this.diagram.model.setDataProperty(link.data, "category", this.selectedLinkCategory);
      }
      return link;
    };
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

  exportarPDF() {
    if (!this.diagram) return;

    const imageData = this.diagram.makeImageData({
      scale: 1,
      background: "white",
      returnType: "image/png"
    });

    if (typeof imageData !== "string") {
      console.error("Error: No se pudo generar la imagen del diagrama");
      return;
    }

    const pdf = new jsPDF("landscape", "mm", "a4");
    pdf.addImage(imageData, "PNG", 10, 10, 280, 150); // Ajustar posición y tamaño
    pdf.save("diagrama-uml.pdf");
  }

  // Guardar el diagrama en localStorage según el tipo
  guardarDiagramaLocal(tipoGrafico: string) {
    if (!this.diagram.model) return;
    const jsonData = this.diagram.model.toJson();
    localStorage.setItem(tipoGrafico, jsonData);
    console.log(`Diagrama ${tipoGrafico} guardado localmente`);
  }

  // Cargar el diagrama desde localStorage según el tipo
  cargarDiagramaLocal(tipoGrafico: string) {
    const jsonData = localStorage.getItem(tipoGrafico);
    if (jsonData) {
      this.diagram.model = go.Model.fromJson(jsonData);
      console.log(`Diagrama ${tipoGrafico} cargado`);
    } else {
      console.log(`No hay diagrama ${tipoGrafico} guardado`);
    }
  }

  cargarModeloSecuencia() {
    const modeloSecuencia = {
      class: "go.GraphLinksModel",
      nodeDataArray: [
        {
          key: "Fred",
          text: "Fred: Usuario",
          nombre: "Fred: Usuario",
          isGroup: true,  // Importante: confirmar que es un grupo
          loc: "0 0",
          category: "Lifeline",
          duration: 300
        },
        {
          key: "Bob",
          text: "Bob: Sistema",
          nombre: "Bob: Sistema",
          isGroup: true,
          loc: "120 0",
          category: "Lifeline",
          duration: 300
        },
        {
          key: "Hank",
          text: "Hank: Base de Datos",
          nombre: "Hank: Base de Datos",
          isGroup: true,
          loc: "240 0",
          category: "Lifeline",
          duration: 300
        },
        { key: -5, group: "Bob", loc: "120 30", category: "Action" },
        { key: -6, group: "Hank", loc: "240 60",category: "Action" },
        { key: -7, group: "Fred", loc: "0 90", category: "Action" },
        { key: -8, group: "Bob", loc: "120 120", category: "Action" },
        { key: -9, group: "Fred", loc: "0 150", category: "Action" },
        {
          key: "nota1",
          category: "TextNode",
          texto: "Nota: Esta es una interacción importante",
          loc: "320 80"
        }
      ],
      linkDataArray: [
        { from: -5, to: -6, text: "consultar(datos)", category: "Message" },
        { from: -6, to: -7, text: "resultado()", category: "Message" },
        { from: -7, to: -8, text: "solicitar()", category: "Message" },
        { from: -8, to: -9, text: "confirmar()", category: "Message" },
        { category: "UniversalLink", points: new go.List().addAll([new go.Point(0, 0), new go.Point(30, 0)]) }
      ]
    };

    this.diagram.model = go.Model.fromJson(modeloSecuencia);
  }

  
  private initPalette() {
    const $ = go.GraphObject.make;
    this.palette = $(go.Palette, "paletteDiv", {
      maxSelectionCount: 1,
      nodeTemplateMap: this.diagram.nodeTemplateMap,
      groupTemplateMap: this.diagram.groupTemplateMap,
      linkTemplateMap: this.diagram.linkTemplateMap,
      model: new go.GraphLinksModel(
        [
          {
            key: "Clase",
            nombre: "NombreClase",
            atributos: [{ text: "+ atributo1: tipo" }],
            metodos: [{ text: "+ metodo1(): tipo" }]
          },
          // Actor
          {
            key: "Actor",
            category: "Actor",
            nombre: "Actor"
          },
          // Caso de Uso
          {
            key: "CasoUso",
            category: "CasoUso",
            nombre: "Caso de Uso"
          },
          // Sistema
          {
            key: "Sistema",
            category: "Sistema",
            nombre: "Sistema",
            isGroup: true,
            width: 200,
            height: 300
          },
          // ===== DIAGRAMA DE SECUENCIA =====
          // Lifeline (línea de vida)
          {
            key: "LifelineObj",
            category: "Lifeline",
            nombre: "Objeto",
            text: "Objeto",
            duration: 300,
            isGroup: true  // Importante: debe ser un grupo
          },
          // Nodo de acción
          {
            key: "ActionNode",
            category: "Action",
            loc: "0 50"
          },
          // Nodo de texto libre
          {
            key: "TextNodeObj",
            category: "TextNode",
            texto: "Texto editable",
            loc: "0 0"
          },
          // Nuevos elementos para diagrama de componentes
          {
            key: "Componente",
            category: "Componente",
            nombre: "<<component>>\nNombreComponente"
          },
          {
            key: "Interface",
            category: "Interface",
            nombre: "<<interface>>\nINombreInterface"
          },
          {
            key: "Paquete",
            category: "Package",
            nombre: "Paquete",
            attributes: "Atributos",  
            isGroup: true
          },
          {
            key: "Paquete",
            category: "MVC",
            nombre: "Modelo",
            attributes: "Atributos",  // Texto por defecto para el cuerpo
            isGroup: true
          },
          {
            key: "Package2",
            category: "MVC",
            nombre: "Vista",
            attributes: "Atributos",  // Texto por defecto para el cuerpo
            isGroup: true
          },
          {
            key: "Package3",
            category: "MVC",
            nombre: "Controlador",
            attributes: "Atributos",  // Texto por defecto para el cuerpo
            isGroup: true
          },
          {
            key: "Container",
            category: "Container",
            nombre: "Container",
            attributes: "Attributes",  // Texto por defecto para el cuerpo
            isGroup: true
          }
        ],
        /*[
          // Mantener los enlaces existentes
          {
            key: -1,
            category: "",
            points: new go.List().addAll([new go.Point(0, 0), new go.Point(30, 0)])
          },
          // Enlace de dependencia
          {
            category: "Dependencia",
            points: new go.List().addAll([new go.Point(0, 0), new go.Point(30, 0)])
          },
          // Flecha de dependencia para paquetes
          {
            category: "PackageDependency",
            points: new go.List().addAll([new go.Point(0, 0), new go.Point(30, 0)])
          },
        ]*/
      )
    });
  }
  
}

