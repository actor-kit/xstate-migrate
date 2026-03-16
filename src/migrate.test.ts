import { Operation } from 'fast-json-patch';
import { AnyMachineSnapshot, createActor, createMachine, setup } from 'xstate';
import { xstateMigrate } from './migrate';

describe('XState Migration', () => {
  test('should generate migrations when new properties are added', () => {
    const machineV1 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0 },
      states: { idle: {}, active: {} },
    });

    const actor = createActor(machineV1).start();
    const persistedSnapshot = actor.getSnapshot();

    const machineV2 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0, newProp: 'default' },
      states: { idle: {}, active: {} },
    });

    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot);

    expect(migrations).toContainEqual({
      op: 'add',
      path: '/context/newProp',
      value: 'default',
    });
  });

  test('should apply migrations to add new properties', () => {
    const persistedSnapshot: AnyMachineSnapshot = {
      context: { count: 5 },
      value: 'active',
      status: 'active',
    } as AnyMachineSnapshot;

    const migrations: Operation[] = [{ op: 'add', path: '/context/newProp', value: 'default' }];

    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    expect(migratedSnapshot.context).toEqual({
      count: 5,
      newProp: 'default',
    });
  });

  test('should generate migration to reset state if it no longer exists', () => {
    const machineV1 = createMachine({
      id: 'test',
      initial: 'active',
      states: {
        idle: {},
        active: {},
      },
    });

    const actor = createActor(machineV1).start();
    const persistedSnapshot = actor.getSnapshot();

    const machineV2 = createMachine({
      id: 'test',
      initial: 'idle',
      states: { idle: {}, newState: {} },
    });

    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value',
      value: 'idle',
    });
  });

  test('should apply migration to reset state', () => {
    const persistedSnapshot: AnyMachineSnapshot = {
      context: {},
      value: 'nonexistentState',
      status: 'active',
    } as AnyMachineSnapshot;

    const migrations: Operation[] = [{ op: 'replace', path: '/value', value: 'idle' }];

    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    expect(migratedSnapshot.value).toBe('idle');
  });

  test('should handle nested state changes', () => {
    const nestedMachineV1 = createMachine({
      id: 'nested',
      initial: 'parent',
      context: { data: '' },
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: {
              on: { NEXT: 'child2' },
            },
            child2: {},
          },
        },
      },
    });

    const actor = createActor(nestedMachineV1).start();
    actor.send({ type: 'NEXT' });
    const persistedSnapshot = actor.getSnapshot();

    const nestedMachineV2 = createMachine({
      id: 'nested',
      initial: 'parent',
      context: { data: '', newData: '' },
      states: {
        parent: {
          initial: 'child1',
          states: { child1: {}, child3: {} },
        },
      },
    });

    const migrations = xstateMigrate.generateMigrations(nestedMachineV2, persistedSnapshot);
    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value/parent',
      value: 'child1',
    });

    expect(migrations).toContainEqual({
      op: 'add',
      path: '/context/newData',
      value: '',
    });

    expect(migratedSnapshot.value).toEqual({ parent: 'child1' });
    expect(migratedSnapshot.context).toEqual({ data: '', newData: '' });
  });

  test('should not replace valid states that already exist', () => {
    const machineV1 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: { on: { EVENT: 'active' } },
        active: {},
      },
    });

    const actor = createActor(machineV1).start();
    actor.send({ type: 'EVENT' });
    const persistedSnapshot = actor.getSnapshot();

    const machineV2 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {},
        active: {},
        new: {},
      },
    });

    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot);

    expect(migrations).not.toContainEqual({
      op: 'replace',
      path: '/value',
      value: 'idle',
    });

    expect(migrations).toEqual([]);
  });

  test('should replace invalid state with the new initial state', () => {
    const machineV1 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: { on: { EVENT: 'active' } },
        active: {},
      },
    });

    const actor = createActor(machineV1).start();
    actor.send({ type: 'EVENT' });
    const persistedSnapshot = actor.getSnapshot();

    const machineV2 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {},
        new: {},
      },
    });

    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value',
      value: 'idle',
    });
  });

  test('should handle migrations for parallel state machines', () => {
    const parallelMachineV1 = createMachine({
      id: 'parallel',
      type: 'parallel',
      states: {
        foo: {
          initial: 'inactive',
          states: {
            inactive: { on: { ACTIVATE_FOO: 'active' } },
            active: {},
          },
        },
        bar: {
          initial: 'inactive',
          states: {
            inactive: { on: { ACTIVATE_BAR: 'active' } },
            active: {},
          },
        },
      },
    });

    const actor = createActor(parallelMachineV1).start();
    actor.send({ type: 'ACTIVATE_FOO' });
    actor.send({ type: 'ACTIVATE_BAR' });
    const persistedSnapshot = actor.getSnapshot();

    const parallelMachineV2 = createMachine({
      id: 'parallel',
      type: 'parallel',
      states: {
        foo: {
          initial: 'inactive',
          states: {
            inactive: {},
            active: {},
            newState: {},
          },
        },
        bar: {
          initial: 'inactive',
          states: {
            inactive: {},
            active: {},
          },
        },
      },
    });

    const migrations = xstateMigrate.generateMigrations(parallelMachineV2, persistedSnapshot);

    expect(migrations).not.toContainEqual({
      op: 'replace',
      path: '/value/foo',
      value: 'inactive',
    });

    expect(migrations).toEqual([]);
  });

  test('should handle complex nested state changes', () => {
    const nestedMachineV1 = createMachine({
      id: 'nestedComplex',
      initial: 'parent',
      context: { data: '' },
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: {
              initial: 'subChild1',
              states: {
                subChild1: {
                  on: { NEXT: 'subChild2' },
                },
                subChild2: {},
              },
            },
            child2: {},
          },
        },
      },
    });

    const actor = createActor(nestedMachineV1).start();
    actor.send({ type: 'NEXT' });
    const persistedSnapshot = actor.getSnapshot();

    const nestedMachineV2 = createMachine({
      id: 'nestedComplex',
      initial: 'parent',
      context: { data: '', newData: '' },
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: {
              initial: 'subChild1',
              states: {
                subChild1: {},
                subChild3: {},
              },
            },
            child3: {},
          },
        },
      },
    });

    const migrations = xstateMigrate.generateMigrations(nestedMachineV2, persistedSnapshot);
    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value/parent/child1',
      value: 'subChild1',
    });

    expect(migrations).toContainEqual({
      op: 'add',
      path: '/context/newData',
      value: '',
    });

    expect(migratedSnapshot.value).toEqual({ parent: { child1: 'subChild1' } });
    expect(migratedSnapshot.context).toEqual({ data: '', newData: '' });
  });

  test('should handle deeply nested states', () => {
    const machineV1 = createMachine({
      id: 'deeplyNested',
      initial: 'level1',
      context: { data: '' },
      states: {
        level1: {
          initial: 'level2',
          states: {
            level2: {
              initial: 'level3',
              states: {
                level3: {
                  initial: 'level4',
                  states: {
                    level4: {
                      on: { NEXT: 'level5' },
                    },
                    level5: {},
                  },
                },
              },
            },
          },
        },
      },
    });

    const actor = createActor(machineV1).start();
    actor.send({ type: 'NEXT' });
    const persistedSnapshot = actor.getSnapshot();

    const machineV2 = createMachine({
      id: 'deeplyNested',
      initial: 'level1',
      context: { data: '', newData: '' },
      states: {
        level1: {
          initial: 'level2',
          states: {
            level2: {
              initial: 'level3',
              states: {
                level3: {
                  initial: 'newLevel5',
                  states: {
                    level4: {},
                    newLevel5: {},
                  },
                },
              },
            },
          },
        },
      },
    });

    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot);
    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value/level1/level2/level3',
      value: 'newLevel5',
    });

    expect(migrations).toContainEqual({
      op: 'add',
      path: '/context/newData',
      value: '',
    });

    expect(migratedSnapshot.value).toEqual({ level1: { level2: { level3: 'newLevel5' } } });
    expect(migratedSnapshot.context).toEqual({ data: '', newData: '' });
  });

  test('should not remove existing context properties when they are not in the new machine', () => {
    // Define the initial machine with extra context properties
    const machineV1 = createMachine({
      id: 'test',
      initial: 'idle',
      context: {
        count: 0,
        importantData: 'Do not remove me',
        anotherImportantProp: 42,
      },
      states: { idle: {}, active: {} },
    });

    // Create an actor and get its snapshot
    const actor = createActor(machineV1).start();
    const persistedSnapshot = actor.getSnapshot();

    // Define the new machine version without mentioning the extra properties
    const machineV2 = createMachine({
      id: 'test',
      initial: 'idle',
      context: { count: 0 },
      states: { idle: {}, active: {} },
    });

    // Generate migrations
    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot);

    // Apply migrations
    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    // Assert that the important properties were not removed
    expect(migratedSnapshot.context).toEqual({
      count: 0,
      importantData: 'Do not remove me',
      anotherImportantProp: 42,
    });

    // Ensure no remove operations were generated for these properties
    expect(migrations).not.toContainEqual({
      op: 'remove',
      path: '/context/importantData',
    });
    expect(migrations).not.toContainEqual({
      op: 'remove',
      path: '/context/anotherImportantProp',
    });
  });
});

describe('Mutation testing survivors', () => {
  test('should handle null values in state object gracefully', () => {
    const machine = createMachine({
      id: 'test',
      initial: 'idle',
      states: { idle: {}, active: {} },
    });

    // Persisted snapshot with a state value that is an object containing null
    const persistedSnapshot = {
      context: {},
      value: { idle: null },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    // Should not throw — the null guard matters
    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);
    expect(migrations).toBeDefined();
  });

  test('should detect invalid nested states within object state values', () => {
    const machine = createMachine({
      id: 'nested',
      initial: 'parent',
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: {},
            child2: {},
          },
        },
      },
    });

    // Persisted with an invalid child state
    const persistedSnapshot = {
      context: {},
      value: { parent: 'removedChild' },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value/parent',
      value: 'child1',
    });
  });

  test('should handle machine IDs with dots correctly in state validation', () => {
    const machine = createMachine({
      id: 'my.app',
      initial: 'idle',
      states: {
        idle: {},
        active: {},
      },
    });

    // Persisted in a removed state — the dot in ID must be replaced with /
    const persistedSnapshot = {
      context: {},
      value: 'removed',
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);

    expect(migrations).toContainEqual({
      op: 'replace',
      path: '/value',
      value: 'idle',
    });

    // Also ensure a valid state with dotted ID produces no migrations
    const validSnapshot = {
      context: {},
      value: 'idle',
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const validMigrations = xstateMigrate.generateMigrations(machine, validSnapshot);
    expect(validMigrations).toEqual([]);
  });

  test('should replace invalid nested string state via the typeof string branch', () => {
    // Tests the branch at line 54: typeof stateValue[key] === 'string' && !validStates.has(...)
    const machine = createMachine({
      id: 'app',
      initial: 'main',
      states: {
        main: {
          initial: 'step1',
          states: {
            step1: {},
            step2: {},
          },
        },
      },
    });

    // Persisted with valid parent but invalid child string state
    const persistedSnapshot = {
      context: {},
      value: { main: 'deletedStep' },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);

    // Must generate exactly one replace for the invalid nested state
    expect(migrations).toEqual([
      {
        op: 'replace',
        path: '/value/main',
        value: 'step1',
      },
    ]);

    // Now test with a VALID nested state — should NOT replace
    const validSnapshot = {
      context: {},
      value: { main: 'step2' },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const validMigrations = xstateMigrate.generateMigrations(machine, validSnapshot);
    expect(validMigrations).toEqual([]);
  });

  test('should detect invalid string child in nested object state value', () => {
    // Directly targets the condition: typeof stateValue[key] === 'string' && !validStates.has(...)
    // When mutated to `false`, this test must fail because no replace operation would be generated
    const machine = createMachine({
      id: 'root',
      type: 'parallel',
      states: {
        regionA: {
          initial: 'a1',
          states: { a1: {}, a2: {} },
        },
        regionB: {
          initial: 'b1',
          states: { b1: {}, b2: {} },
        },
      },
    });

    // regionA has invalid state, regionB is valid
    const persistedSnapshot = {
      context: {},
      value: { regionA: 'removed', regionB: 'b1' },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);

    // Must replace regionA but NOT regionB
    expect(migrations).toHaveLength(1);
    expect(migrations[0]).toEqual({
      op: 'replace',
      path: '/value/regionA',
      value: 'a1',
    });
  });

  test('should not replace valid states when machine ID contains dots (parallel regions)', () => {
    // TLA+ model found this: the object branch (line 55) does NOT replace dots
    // in machine.id, but validStates (line 12) DOES replace dots.
    // So for machine id "my.app" with nested state {auth: "idle"},
    // the object branch looks up "my.app/auth/idle" but validStates has "my/app/auth/idle".
    // This causes valid states to be incorrectly replaced.
    const machine = createMachine({
      id: 'my.app',
      type: 'parallel',
      states: {
        auth: {
          initial: 'idle',
          states: { idle: {}, active: {} },
        },
        nav: {
          initial: 'home',
          states: { home: {}, settings: {} },
        },
      },
    });

    // Both regions are in valid states — no migrations should be needed
    const persistedSnapshot = {
      context: {},
      value: { auth: 'idle', nav: 'home' },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);

    // BUG: This currently generates replace operations because the object branch
    // constructs "my.app/auth/idle" instead of "my/app/auth/idle"
    expect(migrations).toEqual([]);
  });

  test('should not replace valid states when machine ID contains dots (deeply nested)', () => {
    // Verify the dot-replacement fix works at multiple nesting levels
    const machine = createMachine({
      id: 'my.app',
      initial: 'parent',
      states: {
        parent: {
          initial: 'child',
          states: {
            child: {
              initial: 'grandchild',
              states: {
                grandchild: {},
                otherGrandchild: {},
              },
            },
          },
        },
      },
    });

    // All states are valid — no migrations expected
    const persistedSnapshot = {
      context: {},
      value: { parent: { child: 'grandchild' } },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const migrations = xstateMigrate.generateMigrations(machine, persistedSnapshot);
    expect(migrations).toEqual([]);

    // Also test with an INVALID deeply nested state
    const invalidSnapshot = {
      context: {},
      value: { parent: { child: 'removed' } },
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    const invalidMigrations = xstateMigrate.generateMigrations(machine, invalidSnapshot);
    expect(invalidMigrations).toEqual([
      {
        op: 'replace',
        path: '/value/parent/child',
        value: 'grandchild',
      },
    ]);
  });

  test('should only enter string branch when stateValue is actually a string', () => {
    // Exercises the typeof stateValue === 'string' guard at line 67
    const machine = createMachine({
      id: 'test',
      initial: 'idle',
      context: { x: 1 },
      states: { idle: {}, active: {} },
    });

    // Pass a numeric value (not string, not object) to exercise the else-if guard
    const weirdSnapshot = {
      context: { x: 1 },
      value: 42 as any,
      status: 'active',
    } as unknown as AnyMachineSnapshot;

    // With the guard, a non-string non-object value should produce no value operations
    const migrations = xstateMigrate.generateMigrations(machine, weirdSnapshot);
    expect(migrations.filter((op) => op.path.startsWith('/value'))).toEqual([]);
  });
});

describe('XState Migration with typed input and runtime dependency', () => {
  interface RuntimeDependency {
    getSnapshot: () => { value: number };
  }

  const setupMachine = setup({
    types: {
      input: {} as {
        dependency: RuntimeDependency;
      },
      context: {} as {
        snapshotValue: number;
        otherValue: string;
      },
      events: {} as { type: 'UPDATE_SNAPSHOT' } | { type: 'SET_OTHER_VALUE'; value: string },
    },
  });

  test('should migrate machine with runtime dependency in input', () => {
    const mockDependency: RuntimeDependency = {
      getSnapshot: () => ({ value: 42 }),
    };

    const machineV1 = setupMachine.createMachine({
      id: 'runtimeDependencyMachine',
      initial: 'idle',
      context: ({ input }) => ({
        snapshotValue: input.dependency.getSnapshot().value,
        otherValue: 'initial',
      }),
      states: {
        idle: {},
      },
    });

    const actor = createActor(machineV1, {
      input: {
        dependency: mockDependency,
      },
    }).start();

    actor.send({ type: 'SET_OTHER_VALUE', value: 'updated' });
    const persistedSnapshot = actor.getSnapshot();

    // For V2, let's add a new context property that also uses the runtime dependency
    const setupMachineV2 = setup({
      types: {
        input: {} as {
          dependency: RuntimeDependency;
        },
        context: {} as {
          snapshotValue: number;
          otherValue: string;
          newSnapshotValue: number;
        },
        events: {} as { type: 'UPDATE_SNAPSHOT' } | { type: 'SET_OTHER_VALUE'; value: string },
      },
    });

    const machineV2 = setupMachineV2.createMachine({
      id: 'runtimeDependencyMachine',
      initial: 'idle',
      context: ({ input }) => ({
        snapshotValue: input.dependency.getSnapshot().value,
        otherValue: 'initial',
        newSnapshotValue: input.dependency.getSnapshot().value * 2,
      }),
      states: {
        idle: {},
      },
    });

    const migrations = xstateMigrate.generateMigrations(machineV2, persistedSnapshot, {
      dependency: mockDependency,
    });
    const migratedSnapshot = xstateMigrate.applyMigrations(persistedSnapshot, migrations);

    expect(migrations).toContainEqual({
      op: 'add',
      path: '/context/newSnapshotValue',
      value: 84, // 42 * 2
    });

    expect(migratedSnapshot.context).toEqual({
      snapshotValue: 42,
      otherValue: 'initial',
      newSnapshotValue: 84,
    });
  });
});

