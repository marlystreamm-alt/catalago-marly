/** Tipos del apartado Menús (solo administrador). */

export type MenuBusiness = {
  id: string;
  name: string;
  ownerName: string;
  whatsapp: string;
  address: string;
  notes: string;
  active: boolean;
  sortIndex: number;
};

export type MenuCategory = {
  id: string;
  businessId: string;
  name: string;
  sortIndex: number;
};

export type MenuItem = {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  description: string;
  price: number;
  priceText: string;
  imageUrl: string;
  available: boolean;
  sortIndex: number;
};

export type MenuData = {
  business: MenuBusiness;
  categories: MenuCategory[];
  items: MenuItem[];
};

export const emptyBusiness = (): Omit<MenuBusiness, "id"> => ({
  name: "",
  ownerName: "",
  whatsapp: "",
  address: "",
  notes: "",
  active: true,
  sortIndex: 0,
});
