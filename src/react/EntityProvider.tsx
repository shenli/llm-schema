import React from 'react';

export interface Entity {
  type: string;
  id: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface EntityResolver {
  byType: (type: string) => Entity[];
  byId: (type: string, id: string) => Entity | undefined;
  search: (type: string, query: string) => Entity[];
  register: (entity: Entity) => void;
  remove: (type: string, id: string) => void;
  all: Entity[];
}

const EntityContext = React.createContext<EntityResolver | null>(null);

export interface EntityProviderProps {
  entities?: Entity[];
  onChange?: (entities: Entity[]) => void;
  children: React.ReactNode;
}

export function EntityProvider({ entities, onChange, children }: EntityProviderProps) {
  const [internal, setInternal] = React.useState<Entity[]>(entities ?? []);
  const isControlled = entities !== undefined;
  const current = isControlled ? entities! : internal;

  const update = React.useCallback(
    (next: Entity[]) => {
      if (isControlled) {
        onChange?.(next);
      } else {
        setInternal(next);
        onChange?.(next);
      }
    },
    [isControlled, onChange]
  );

  const resolver = React.useMemo<EntityResolver>(() => {
    const byType = (type: string) => current.filter((e) => e.type === type);
    const byId = (type: string, id: string) =>
      current.find((e) => e.type === type && e.id === id);
    const search = (type: string, query: string) => {
      const needle = query.toLowerCase();
      if (!needle) return byType(type);
      return byType(type).filter(
        (e) => e.label.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle)
      );
    };
    const register = (entity: Entity) => {
      const without = current.filter((e) => !(e.type === entity.type && e.id === entity.id));
      update([...without, entity]);
    };
    const remove = (type: string, id: string) => {
      update(current.filter((e) => !(e.type === type && e.id === id)));
    };
    return { byType, byId, search, register, remove, all: current };
  }, [current, update]);

  return <EntityContext.Provider value={resolver}>{children}</EntityContext.Provider>;
}

export function useEntityResolver(): EntityResolver | null {
  return React.useContext(EntityContext);
}

export function useEntity(type: string, id: string | undefined): Entity | undefined {
  const resolver = useEntityResolver();
  if (!resolver || !id) return undefined;
  return resolver.byId(type, id);
}

export function useEntitiesOfType(type: string): Entity[] {
  const resolver = useEntityResolver();
  if (!resolver) return [];
  return resolver.byType(type);
}
