import { test, expect } from '@playwright/test';

test.describe('Role Navigation Checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should log in as Director successfully', async ({ page }) => {
    // Click director login button
    await page.locator('.role-btn.director').click();
    
    // Assert navigation layout is displayed and sidebar contains menu-director
    await expect(page.locator('#app-root')).toBeVisible();
    await expect(page.locator('#menu-director')).toBeVisible();
    
    // Assert current username contains 원장
    const profileName = await page.locator('#user-name').innerText();
    expect(profileName).toContain('원장');
  });

  test('should log in as Teacher successfully', async ({ page }) => {
    // Click teacher login button
    await page.locator('.role-btn.teacher').click();
    
    // Assert teacher menu list is visible
    await expect(page.locator('#app-root')).toBeVisible();
    await expect(page.locator('#menu-teacher')).toBeVisible();
    
    // Assert profile name contains 강사
    const profileName = await page.locator('#user-name').innerText();
    expect(profileName).toMatch(/(강사|선생님)/i);
  });

  test('should log in as Student/Parent successfully', async ({ page }) => {
    // Click student/parent login button
    await page.locator('.role-btn.student').click();
    
    // Assert student/parent menu is visible
    await expect(page.locator('#app-root')).toBeVisible();
    await expect(page.locator('#menu-student')).toBeVisible();
  });
});
