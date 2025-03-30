'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X, ArrowRight, ArrowDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

type Condition = {
  id: string;
  symbol: string;
  condition: 'above' | 'below' | 'between' | 'change';
  value: number;
  value2?: number;
  percentageChange?: number;
  isReference?: boolean;
};

type AlertCondition = {
  assets: Condition[];
  logicOperator: 'AND' | 'OR';
};

interface AlertBuilderProps {
  initialCondition?: AlertCondition;
  onChange: (_condition: AlertCondition) => void;
  availableSymbols: string[];
}

export function AlertBuilder({ initialCondition, onChange, availableSymbols }: AlertBuilderProps) {
  const [condition, setCondition] = useState<AlertCondition>(
    initialCondition || {
      assets: [],
      logicOperator: 'AND',
    }
  );

  const handleDragEnd = (_condition: DropResult) => {
    if (!_condition.destination) return;

    const assets = Array.from(condition.assets);
    const [reorderedItem] = assets.splice(_condition.source.index, 1);
    assets.splice(_condition.destination.index, 0, reorderedItem);

    const newCondition = {
      ...condition,
      assets,
    };

    setCondition(newCondition);
    onChange(newCondition);
  };

  const addCondition = () => {
    const newCondition = {
      ...condition,
      assets: [
        ...condition.assets,
        {
          id: Math.random().toString(36).substr(2, 9),
          symbol: availableSymbols[0],
          condition: 'above' as const,
          value: 0,
        },
      ],
    };

    setCondition(newCondition);
    onChange(newCondition);
  };

  const removeCondition = (index: number) => {
    const newCondition = {
      ...condition,
      assets: condition.assets.filter((_, i) => i !== index),
    };

    setCondition(newCondition);
    onChange(newCondition);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newCondition = {
      ...condition,
      assets: condition.assets.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    };

    setCondition(newCondition);
    onChange(newCondition);
  };

  const toggleLogicOperator = () => {
    const newCondition = {
      ...condition,
      logicOperator: condition.logicOperator === 'AND' ? 'OR' : 'AND',
    } as const;

    setCondition(newCondition);
    onChange(newCondition);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="conditions">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {condition.assets.map((asset, index) => (
                <Draggable key={asset.id} draggableId={asset.id} index={index}>
                  {(provided) => (
                    <Card ref={provided.innerRef} {...provided.draggableProps} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div {...provided.dragHandleProps} className="cursor-move">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <Select
                            value={asset.symbol}
                            onValueChange={(value) => updateCondition(index, { symbol: value })}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSymbols.map((symbol) => (
                                <SelectItem key={symbol} value={symbol}>
                                  {symbol}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={asset.condition}
                            onValueChange={(value) =>
                              updateCondition(index, {
                                condition: value as Condition['condition'],
                              })
                            }
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="above">Above</SelectItem>
                              <SelectItem value="below">Below</SelectItem>
                              <SelectItem value="between">Between</SelectItem>
                              <SelectItem value="change">Change</SelectItem>
                            </SelectContent>
                          </Select>

                          {asset.condition === 'between' ? (
                            <>
                              <Input
                                type="number"
                                value={asset.value}
                                onChange={(e) =>
                                  updateCondition(index, {
                                    value: parseFloat(e.target.value),
                                  })
                                }
                                className="w-[100px]"
                                placeholder="Min"
                              />
                              <Input
                                type="number"
                                value={asset.value2}
                                onChange={(e) =>
                                  updateCondition(index, {
                                    value2: parseFloat(e.target.value),
                                  })
                                }
                                className="w-[100px]"
                                placeholder="Max"
                              />
                            </>
                          ) : asset.condition === 'change' ? (
                            <Input
                              type="number"
                              value={asset.percentageChange}
                              onChange={(e) =>
                                updateCondition(index, {
                                  percentageChange: parseFloat(e.target.value),
                                })
                              }
                              className="w-[100px]"
                              placeholder="%"
                            />
                          ) : (
                            <Input
                              type="number"
                              value={asset.value}
                              onChange={(e) =>
                                updateCondition(index, {
                                  value: parseFloat(e.target.value),
                                })
                              }
                              className="w-[100px]"
                              placeholder="Value"
                            />
                          )}

                          {asset.condition === 'change' && (
                            <Select
                              value={asset.isReference ? 'reference' : 'target'}
                              onValueChange={(value) =>
                                updateCondition(index, {
                                  isReference: value === 'reference',
                                })
                              }
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="target">Target</SelectItem>
                                <SelectItem value="reference">Reference</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCondition(index)}
                            className="ml-auto"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="flex items-center gap-4">
        <Button onClick={addCondition} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Condition
        </Button>

        {condition.assets.length > 1 && (
          <Button variant="outline" onClick={toggleLogicOperator} className="gap-2">
            {condition.logicOperator === 'AND' ? (
              <>
                <ArrowRight className="h-4 w-4" />
                AND
              </>
            ) : (
              <>
                <ArrowDown className="h-4 w-4" />
                OR
              </>
            )}
          </Button>
        )}
      </div>

      {condition.assets.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {condition.assets.map((asset, index) => (
            <span key={asset.id}>
              {index > 0 && <span className="mx-2 font-bold">{condition.logicOperator}</span>}
              {asset.symbol}{' '}
              {asset.condition === 'between'
                ? `between $${asset.value} and $${asset.value2}`
                : asset.condition === 'change'
                  ? `${asset.isReference ? 'stays within' : 'changes by'} ${
                      asset.percentageChange
                    }%`
                  : `${asset.condition} $${asset.value}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
