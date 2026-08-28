'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, FolderTree, Plus, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Department {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  departmentId: string;
  department?: { id: string; name: string };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [deptIdInput, setDeptIdInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [catRes, deptRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/departments'),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(Array.isArray(catData) ? catData : catData.data || []);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        const dList = Array.isArray(deptData) ? deptData : deptData.data || [];
        setDepartments(dList);
        if (dList.length > 0) {
          setDeptIdInput(dList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load categories data:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingCategory(null);
    setNameInput('');
    setDescInput('');
    setError('');
    if (departments.length > 0) setDeptIdInput(departments[0].id);
    setIsModalOpen(true);
  }

  function openEditModal(cat: Category) {
    setEditingCategory(cat);
    setNameInput(cat.name);
    setDescInput(cat.description);
    setDeptIdInput(cat.departmentId);
    setError('');
    setIsModalOpen(true);
  }

  async function handleSubmit() {
    if (!nameInput.trim() || !descInput.trim() || !deptIdInput) {
      setError('Category name, description, and department mapping are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.trim(),
          description: descInput.trim(),
          departmentId: deptIdInput,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const errData = await res.json();
        setError(errData.message || 'Failed to save category');
      }
    } catch (err) {
      setError('An error occurred while saving category.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Category Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Define complaint issue categories and default department routing rules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading categories...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat) => (
              <Card key={cat.id} className="border shadow-sm bg-white flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <FolderTree className="w-5 h-5 text-purple-600" />
                      <CardTitle className="text-lg font-bold text-slate-900">
                        {cat.name}
                      </CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(cat)}>
                      <Edit2 className="w-4 h-4 text-slate-600" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600 line-clamp-2">{cat.description}</p>
                  <div className="pt-2 border-t text-xs text-slate-500 flex justify-between items-center">
                    <span>Mapped Dept:</span>
                    <span className="font-semibold text-slate-800">
                      {cat.department?.name || 'Unassigned'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create / Edit Category Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Modify category rules and department mapping.'
                  : 'Add a new complaint category and map to a target department.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
                  {error}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Category Name
                </label>
                <Input
                  placeholder="e.g. Water Leakage & Mains"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description
                </label>
                <textarea
                  className="w-full min-h-[90px] p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe issues falling under this category..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Department
                </label>
                <Select value={deptIdInput} onChange={(e) => setDeptIdInput(e.target.value)}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
