declare module "graphql" {
  export type DocumentNode = {
    definitions: DefinitionNode[];
  };

  export type DefinitionNode = OperationDefinitionNode | OtherDefinitionNode;

  export type OtherDefinitionNode = {
    kind: string;
  };

  export type OperationDefinitionNode = {
    kind: "OperationDefinition";
    operation: "query" | "mutation" | "subscription";
    name?: { value: string };
    selectionSet: SelectionSetNode;
    variableDefinitions?: VariableDefinitionNode[];
  };

  export type VariableDefinitionNode = {
    variable: { name: { value: string } };
    type: TypeNode;
  };

  export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

  export type NamedTypeNode = {
    kind: "NamedType";
    name: { value: string };
  };

  export type ListTypeNode = {
    kind: "ListType";
    type: TypeNode;
  };

  export type NonNullTypeNode = {
    kind: "NonNullType";
    type: TypeNode;
  };

  export type SelectionSetNode = {
    kind: "SelectionSet";
    selections: SelectionNode[];
  };

  export type SelectionNode = FieldNode | InlineFragmentNode | FragmentSpreadNode;

  export type FieldNode = {
    kind: "Field";
    name: { value: string };
    selectionSet?: SelectionSetNode;
  };

  export type InlineFragmentNode = {
    kind: "InlineFragment";
    selectionSet: SelectionSetNode;
  };

  export type FragmentSpreadNode = {
    kind: "FragmentSpread";
    name: { value: string };
  };

  export function parse(source: string): DocumentNode;
}
